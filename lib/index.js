// dsh-deepseek-balance — host half.
//
// A static Cordis plugin for the deepseek-harness web profile. This file is the
// assembly layer only: it owns the lifecycle (state file, polling loop, HTTP
// routes) and delegates the real work to focused modules:
//
//   lib/phase.js     peak/valley price phases + statutory-holiday calendar
//   lib/window.js    window range, snapshot estimation, monthly usage summing
//   lib/deepseek.js  balance/usage HTTP client and payload parsing
//   lib/validate.js  /dsbal/* request validation
//
//   * polls the DeepSeek balance endpoint (and, when a platform userToken is
//     configured, the private usage endpoints) every 5 minutes,
//   * persists keys and balance snapshots to ~/.deepseek-balance.json,
//   * serves the widget via same-origin /dsbal/* HTTP routes on the harness
//     web server (the browser client module consumes them with fetch()); every
//     route passes ctx.connection.admit() first, so it is exactly as protected
//     as the host's own /api surface.
//
// The browser half is registered automatically because this package declares
// `dsh.client` in package.json (see repository README for installation).

import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { API_DEFAULTS, fetchBalance, fetchMonthData, normalizeToken } from './deepseek.js'
import { BJ_OFFSET, phaseInfo } from './phase.js'
import { WINDOW_IDS, parseConfigRequest, parseWindowRequest, validateApiKeyForSave } from './validate.js'
import { monthRange, spentFromSnapshots, sumMonths, windowOf } from './window.js'

const FILE_NAME = '.deepseek-balance.json'
const POLL_MS = 5 * 60 * 1000
const HISTORY_DAYS = 90
const USAGE_TTL_MS = 60 * 60 * 1000
const USAGE_ERR_TTL_MS = 10 * 60 * 1000

export default {
  // `connection` is the host's own request gate (Host/Origin fence + browser
  // cookie auth, the same one the /api RPC channel uses). Injecting it means the
  // plugin refuses to activate in a profile that cannot authenticate callers,
  // which is the safe default for a surface that can write credentials.
  inject: ['timer', 'webServer', 'connection'],
  async apply(ctx) {
    const timer = ctx.timer
    const webServer = ctx.webServer
    const stateFile = join(process.env.DSH_HOME || homedir(), FILE_NAME)
    const apiOptions = { ...API_DEFAULTS }

    let store = null
    let lastBalance = null
    let busy = false
    const usageCache = {}

    async function loadStore() {
      let loaded = null
      try {
        loaded = JSON.parse(await readFile(stateFile, 'utf8'))
      } catch { loaded = null }
      store = loaded && typeof loaded === 'object' ? loaded : {}
      store.apiKey = typeof store.apiKey === 'string' ? store.apiKey.trim() : ''
      store.platformToken = typeof store.platformToken === 'string' ? normalizeToken(store.platformToken) : ''
      if (!Array.isArray(store.snapshots)) store.snapshots = []
      if (!store.settings || typeof store.settings !== 'object') store.settings = {}
      store.settings.window = WINDOW_IDS.includes(store.settings.window) ? store.settings.window : 'today'
      store.settings.customFromMs = typeof store.settings.customFromMs === 'number' ? store.settings.customFromMs : null
    }

    async function saveStore() {
      try {
        await writeFile(stateFile, JSON.stringify(store), { mode: 0o600 })
      } catch (err) {
        console.error('[dsbal] save failed', err && err.message ? err.message : err)
      }
    }

    // ---- monthly usage, with a short-lived cache -------------------------------
    async function loadMonth(year, month) {
      const key = `${year}-${month}`
      let entry = usageCache[key]
      const now = Date.now()
      const ttl = entry && entry.error ? USAGE_ERR_TTL_MS : USAGE_TTL_MS
      if (!entry || now - entry.fetchedAtMs > ttl) {
        try {
          const res = await fetchMonthData(year, month, store.platformToken, apiOptions)
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
      const w = windowOf(store.settings, nowMs, BJ_OFFSET)
      let spent = null
      let source = null
      let partial = false
      let usageError = null
      let models = []
      let tokens = null
      let tokenError = null
      if (w.fromMs != null && store.platformToken) {
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
        const est = store.apiKey ? spentFromSnapshots(store.snapshots, w.fromMs, w.toMs) : null
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
      if (busy || !store) return
      busy = true
      try {
        if (store.apiKey) {
          const b = await fetchBalance(store.apiKey, apiOptions)
          const nowMs = Date.now()
          lastBalance = { currency: b.currency, total: b.total, toppedUp: b.toppedUp, granted: b.granted, available: b.available, fetchedAtMs: nowMs }
          const snaps = store.snapshots
          const last = snaps.length ? snaps[snaps.length - 1] : null
          const changed = !last || Math.abs((last.total || 0) - b.total) > 1e-9
          const gap = !last || nowMs - last.t > 3600000
          if (changed || gap) {
            snaps.push({ t: nowMs, total: b.total, topped: b.toppedUp, granted: b.granted, currency: b.currency })
            const cutoff = nowMs - HISTORY_DAYS * 86400000
            while (snaps.length && snaps[0].t < cutoff) snaps.shift()
            if (snaps.length > 5000) snaps.splice(0, snaps.length - 5000)
          }
          store.lastPollAtMs = nowMs
          store.lastError = null
        } else {
          lastBalance = null
          store.lastError = '未配置 DeepSeek API Key，请点击「配置」填写'
        }
      } catch (err) {
        store.lastError = String((err && err.message) || err)
      } finally {
        busy = false
        void saveStore()
      }
    }

    async function buildState() {
      const nowMs = Date.now()
      const keyMask = store.apiKey ? 'sk-****' + String(store.apiKey).slice(-4) : null
      const win = await computeWindow(nowMs)
      return {
        nowMs,
        configured: { apiKey: !!store.apiKey, platformToken: !!store.platformToken },
        keyMask,
        balance: lastBalance,
        phase: phaseInfo(nowMs),
        window: win,
        historyCount: store.snapshots.length,
        lastPollAtMs: store.lastPollAtMs || null,
        lastError: store.lastError || null,
        pollIntervalMs: POLL_MS,
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

    await loadStore()
    await saveStore()
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
          if (a.apiKey !== null) store.apiKey = validateApiKeyForSave(a.apiKey)
          if (a.platformToken !== null) store.platformToken = normalizeToken(a.platformToken)
          if (a.clear) {
            store.apiKey = ''
            store.platformToken = ''
            lastBalance = null
          }
          for (const k in usageCache) delete usageCache[k]
          await saveStore()
          await poll()
          const state = await buildState()
          if (a.ignored.length) state.ignoredFields = a.ignored
          sendJson(res, 200, state)
        } catch (err) {
          sendJson(res, 400, { error: String((err && err.message) || err) })
        }
      }),
      registerRoute('POST', '/dsbal/window', async (req, res) => {
        try {
          const a = parseWindowRequest(await readBody(req))
          store.settings.window = a.id
          if (a.id === 'custom' && a.fromMs != null) store.settings.customFromMs = a.fromMs
          if (a.id !== 'custom') store.settings.customFromMs = null
          await saveStore()
          sendJson(res, 200, await buildState())
        } catch (err) {
          sendJson(res, 400, { error: String((err && err.message) || err) })
        }
      }),
    ]

    ctx.effect(() => () => {
      for (const d of disposers) d()
    })

    timer.interval(() => void poll(), POLL_MS)
  },
}
