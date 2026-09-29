// dsh-deepseek-balance — host half.
//
// A static Cordis plugin for the deepseek-harness web profile. This file is the
// assembly layer only: it owns the lifecycle (config, state file, polling loop,
// HTTP routes) and delegates the real work to focused modules:
//
//   lib/phase.js     peak/valley price phases + statutory-holiday calendar
//   lib/window.js    window range, snapshot estimation, monthly usage summing
//   lib/deepseek.js  balance/usage HTTP client and payload parsing
//   lib/validate.js  /dsbal/* request validation
//   lib/config.js    tunables + validation of the profile's `config:`
//   lib/store.js     state-file load/save (atomic, serialised, versioned)
//
//   * polls the DeepSeek balance endpoint (and, when a platform userToken is
//     configured, the private usage endpoints) every `pollIntervalMs`,
//   * persists keys and balance snapshots to $DSH_HOME/.deepseek-balance.json,
//   * serves the widget via same-origin /dsbal/* HTTP routes on the harness
//     web server (the browser client module consumes them with fetch()); every
//     route passes ctx.connection.admit() first, so it is exactly as protected
//     as the host's own /api surface.
//
// The browser half is registered automatically because this package declares
// `dsh.client` in package.json (see repository README for installation).

import { homedir } from 'node:os'

import { apiOptions, resolveConfig } from './config.js'
import { fetchBalance, fetchMonthData, normalizeToken } from './deepseek.js'
import { localeFromSettings } from './i18n.js'
import { BJ_OFFSET, phaseInfo } from './phase.js'
import { SCHEMA_VERSION, createStore, emptyState, stateFilePath } from './store.js'
import { WINDOW_IDS, parseConfigRequest, parseWindowRequest, validateApiKeyForSave } from './validate.js'
import { monthRange, spentFromSnapshots, sumMonths, windowOf } from './window.js'

/** `connection` is the host's own request gate (Host/Origin fence + browser cookie
 *  auth, the same one the /api RPC channel uses). Injecting it means the plugin
 *  refuses to activate in a profile that cannot authenticate callers, which is the
 *  safe default for a surface that can write credentials. */
export const inject = ['timer', 'webServer', 'connection']

/**
 * @param ctx - plugin context (timer, webServer, connection).
 * @param rawConfig - the profile patch's `config:` object; validated by resolveConfig.
 */
export async function apply(ctx, rawConfig) {
  const config = resolveConfig(rawConfig)
  const timer = ctx.timer
  const webServer = ctx.webServer
  const api = apiOptions(config)
  const stateStore = createStore(stateFilePath(process.env.DSH_HOME || homedir()), normalizeState)

  let state = emptyState()
  let lastBalance = null
  let busy = false
  let hostLocale = null
  const usageCache = {}

  // The user's explicit language choice lives in the host settings document. This
  // is read through a scoped injection so a profile without a settings service
  // still activates (the client then falls back to its own detection).
  ctx.inject(['settings'], (sctx) => {
    const read = () => {
      hostLocale = localeFromSettings(sctx.settings) || null
    }
    read()
    sctx.on('settings/document-updated', read)
  })

  /** Coerce whatever was on disk into the shape the rest of this file assumes. */
  function normalizeState(doc) {
    const d = doc && typeof doc === 'object' && !Array.isArray(doc) ? doc : {}
    const settings = d.settings && typeof d.settings === 'object' ? d.settings : {}
    const cutoff = Date.now() - config.historyDays * 86400000
    const snapshots = (Array.isArray(d.snapshots) ? d.snapshots : [])
      .filter((s) => s && typeof s.t === 'number' && typeof s.total === 'number' && s.t >= cutoff)
      .slice(-config.maxSnapshots)
    return {
      ...emptyState(),
      ...d,
      schemaVersion: SCHEMA_VERSION,
      apiKey: typeof d.apiKey === 'string' ? d.apiKey.trim() : '',
      platformToken: typeof d.platformToken === 'string' ? normalizeToken(d.platformToken) : '',
      snapshots,
      settings: {
        window: WINDOW_IDS.includes(settings.window) ? settings.window : 'today',
        customFromMs: typeof settings.customFromMs === 'number' ? settings.customFromMs : null,
      },
      lastPollAtMs: typeof d.lastPollAtMs === 'number' ? d.lastPollAtMs : null,
      lastError: typeof d.lastError === 'string' ? d.lastError : null,
    }
  }

  const save = () => void stateStore.save(state)

  // ---- monthly usage, with a short-lived cache -------------------------------
  async function loadMonth(year, month) {
    const key = `${year}-${month}`
    let entry = usageCache[key]
    const now = Date.now()
    const ttl = entry && entry.error ? config.usageErrorTtlMs : config.usageTtlMs
    if (!entry || now - entry.fetchedAtMs > ttl) {
      try {
        const res = await fetchMonthData(year, month, state.platformToken, api)
        entry = { costDays: res.costDays, amountDays: res.amountDays, amountError: res.amountError, fetchedAtMs: now }
      } catch (err) {
        entry = { error: String((err && err.message) || err), fetchedAtMs: now }
      }
      usageCache[key] = entry
    }
    return entry
  }

  /** Official usage for a window; throws when the platform rejects a month. */
  async function officialWindow(fromMs, toMs) {
    if (fromMs == null) return null
    const range = monthRange(fromMs, toMs, BJ_OFFSET)
    const entries = []
    for (const { year, month } of range.months) {
      const entry = await loadMonth(year, month)
      if (entry.error) throw new Error(entry.error)
      entries.push(entry)
    }
    return sumMonths(entries, range)
  }

  async function computeWindow(nowMs) {
    const w = windowOf(state.settings, nowMs, BJ_OFFSET)
    let spent = null
    let source = null
    let partial = false
    let usageError = null
    let models = []
    let tokens = null
    let tokenError = null
    if (w.fromMs != null && state.platformToken) {
      try {
        const res = await officialWindow(w.fromMs, w.toMs)
        spent = res.total
        models = res.models
        tokens = res.tokens
        tokenError = res.tokenError
        source = 'official'
      } catch (err) {
        usageError = String((err && err.message) || err)
      }
    }
    if (spent == null && w.fromMs != null) {
      // Fall back to the balance-snapshot estimate (only the API key is needed).
      const est = state.apiKey ? spentFromSnapshots(state.snapshots, w.fromMs, w.toMs) : null
      if (est) {
        spent = est.spent
        partial = est.partial
        source = 'estimate'
      }
    }
    return { id: w.id, fromMs: w.fromMs, toMs: w.toMs, spent, source, partial, usageError, models, tokens, tokenError }
  }

  // ---- polling --------------------------------------------------------------
  async function poll() {
    if (busy) return
    busy = true
    try {
      if (state.apiKey) {
        const b = await fetchBalance(state.apiKey, api)
        const nowMs = Date.now()
        lastBalance = { currency: b.currency, total: b.total, toppedUp: b.toppedUp, granted: b.granted, available: b.available, fetchedAtMs: nowMs }
        const snaps = state.snapshots
        const last = snaps.length ? snaps[snaps.length - 1] : null
        const changed = !last || Math.abs((last.total || 0) - b.total) > 1e-9
        const gap = !last || nowMs - last.t > 3600000
        if (changed || gap) {
          snaps.push({ t: nowMs, total: b.total, topped: b.toppedUp, granted: b.granted, currency: b.currency })
          const cutoff = nowMs - config.historyDays * 86400000
          while (snaps.length && snaps[0].t < cutoff) snaps.shift()
          if (snaps.length > config.maxSnapshots) snaps.splice(0, snaps.length - config.maxSnapshots)
        }
        state.lastPollAtMs = nowMs
        state.lastError = null
      } else {
        lastBalance = null
        state.lastError = '未配置 DeepSeek API Key，请点击「配置」填写'
      }
    } catch (err) {
      state.lastError = String((err && err.message) || err)
    } finally {
      busy = false
      save()
    }
  }

  async function buildState() {
    const nowMs = Date.now()
    const keyMask = state.apiKey ? 'sk-****' + String(state.apiKey).slice(-4) : null
    const win = await computeWindow(nowMs)
    return {
      nowMs,
      configured: { apiKey: !!state.apiKey, platformToken: !!state.platformToken },
      keyMask,
      balance: lastBalance,
      phase: phaseInfo(nowMs),
      window: win,
      historyCount: state.snapshots.length,
      lastPollAtMs: state.lastPollAtMs || null,
      lastError: state.lastError || null,
      pollIntervalMs: config.pollIntervalMs,
      // The language the host knows about (null = "the browser decides"); the
      // client combines this with its own fallbacks and any explicit toggle.
      locale: hostLocale,
      // Local persistence problems (unreadable/corrupt file, failed save) are
      // reported separately from upstream API failures so the panel can say which
      // one happened instead of showing an empty history without explanation.
      storageError: stateStore.loadError || stateStore.saveError || null,
    }
  }

  // ---- same-origin HTTP surface ---------------------------------------------
  // Every route passes the host's own gate first: ctx.connection.admit() applies
  // the same Host/Origin trust fence and browser-cookie authentication as the
  // /api RPC channel. `webServer` itself knows no harness concepts — a bare
  // registration exposes account data (and credential writes) to anything that
  // can reach the port, which is exactly what this guard prevents.
  // Fail closed: without the gate service nothing is served at all.
  function sendText(res, status, text, extraHeaders) {
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders })
    res.end(text)
  }
  function guard(req, res) {
    const gate = ctx.connection
    const admission = gate && typeof gate.admit === 'function' ? gate.admit(req) : null
    if (!admission) {
      sendText(res, 401, 'unauthorized')
      return false
    }
    if ('rejection' in admission) {
      sendText(res, admission.rejection, admission.rejection === 401 ? 'unauthorized' : 'forbidden')
      return false
    }
    return true
  }
  function sendJson(res, status, data) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(data))
  }
  function readBody(req) {
    return new Promise((resolve, reject) => {
      let data = ''
      req.on('data', (c) => {
        data += c
        if (data.length > 1024 * 1024) {
          reject(new Error('body too large'))
          req.destroy()
        }
      })
      req.on('end', () => resolve(data))
      req.on('error', reject)
    })
  }
  /**
   * Register one authenticated exact route. `method` is enforced (HEAD is
   * allowed wherever GET is) so a state-changing route cannot be driven by a
   * cross-site "simple" GET either.
   */
  function registerRoute(method, path, handler) {
    return webServer.register({
      kind: 'exact',
      path,
      handler: async (req, res) => {
        if (!guard(req, res)) return
        const actual = req.method || 'GET'
        if (actual !== method && !(method === 'GET' && actual === 'HEAD')) {
          sendText(res, 405, 'method not allowed', { allow: method })
          return
        }
        await handler(req, res)
      },
    })
  }

  state = await stateStore.load()
  save()

  void poll()

  const disposers = [
    registerRoute('GET', '/dsbal/state', async (req, res) => {
      try {
        sendJson(res, 200, await buildState())
      } catch (err) {
        sendJson(res, 500, { error: String((err && err.message) || err) })
      }
    }),
    registerRoute('POST', '/dsbal/refresh', async (req, res) => {
      try {
        for (const k in usageCache) delete usageCache[k]
        await poll()
        sendJson(res, 200, await buildState())
      } catch (err) {
        sendJson(res, 500, { error: String((err && err.message) || err) })
      }
    }),
    registerRoute('POST', '/dsbal/config', async (req, res) => {
      try {
        const a = parseConfigRequest(await readBody(req))
        if (a.apiKey !== null) state.apiKey = validateApiKeyForSave(a.apiKey)
        if (a.platformToken !== null) state.platformToken = normalizeToken(a.platformToken)
        if (a.clear) {
          state.apiKey = ''
          state.platformToken = ''
          lastBalance = null
        }
        for (const k in usageCache) delete usageCache[k]
        save()
        await poll()
        const snapshot = await buildState()
        if (a.ignored.length) snapshot.ignoredFields = a.ignored
        sendJson(res, 200, snapshot)
      } catch (err) {
        sendJson(res, 400, { error: String((err && err.message) || err) })
      }
    }),
    registerRoute('POST', '/dsbal/window', async (req, res) => {
      try {
        const a = parseWindowRequest(await readBody(req))
        state.settings.window = a.id
        if (a.id === 'custom' && a.fromMs != null) state.settings.customFromMs = a.fromMs
        if (a.id !== 'custom') state.settings.customFromMs = null
        save()
        sendJson(res, 200, await buildState())
      } catch (err) {
        sendJson(res, 400, { error: String((err && err.message) || err) })
      }
    }),
  ]

  ctx.effect(() => () => {
    for (const d of disposers) d()
  })

  timer.interval(() => void poll(), config.pollIntervalMs)
}
