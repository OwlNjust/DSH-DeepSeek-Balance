// The plugin's operations, in one place.
//
// Everything the widget (and, in a deployment that can resolve @deepseek-ai/*
// packages, a future read-only agent tool) can ask for lives here: polling the
// balance, computing a window's spend, saving a window, saving credentials, and
// rendering the state payload. lib/index.js only assembles this with the HTTP
// routes, so there is exactly one implementation of each operation and no route
// can quietly diverge from it.
//
// Credential writes are user-only by construction: they are reachable through
// setConfig(), which the routes expose to the authenticated browser and which a
// model-facing tool must never wrap. See README "Model access" for why the tool
// half is not registered yet.

import { fetchBalance, fetchMonthData, normalizeToken } from './deepseek.js'
import { BJ_OFFSET, phaseInfo } from './phase.js'
import { SCHEMA_VERSION, emptyState } from './store.js'
import { WINDOW_IDS, validateApiKeyForSave } from './validate.js'
import { monthRange, spentFromSnapshots, sumMonths, windowOf } from './window.js'

/**
 * Coerce whatever was on disk into the shape the service assumes.
 * Unknown fields are preserved (forward compatibility); the known ones are
 * clamped to the configured caps.
 * @param doc - parsed state file content, or anything else.
 * @param config - resolved plugin config.
 */
export function normalizeState(doc, config) {
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

/**
 * Build the operation set.
 * @param options.config - resolved config (lib/config.js).
 * @param options.api - HTTP options for lib/deepseek.js.
 * @param options.stateStore - lib/store.js handle (save + error reporting).
 * @param options.initial - already-normalised state (from stateStore.load()).
 * @param options.locale - language the host knows, or null.
 * @param options.http - HTTP layer, injectable so tests can run without network
 *   (`{ fetchBalance, fetchMonthData }`); defaults to lib/deepseek.js.
 */
export function createService({ config, api, stateStore, initial, locale, http }) {
  const balance = (http && http.fetchBalance) || fetchBalance
  const monthData = (http && http.fetchMonthData) || fetchMonthData
  let state = initial
  let lastBalance = null
  let busy = false
  const usageCache = {}

  /** Ask the host for the current language (called when the settings change). */
  let hostLocale = locale === undefined ? null : locale
  const setLocale = (value) => {
    hostLocale = value || null
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
        const res = await monthData(year, month, state.platformToken, api)
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

  return {
    /** The live document (read-only use: routes read nothing else). */
    get state() {
      return state
    },
    /** Local persistence problems, for the panel. */
    storageError: () => stateStore.loadError || stateStore.saveError || null,
    /** Update the language the host knows about. */
    setLocale,

    /** Poll the balance endpoint once; never throws (the reason lands in state.lastError). */
    async poll() {
      if (busy) return
      busy = true
      try {
        if (state.apiKey) {
          const b = await balance(state.apiKey, api)
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
    },

    /** Drop the usage cache and poll again (the panel's 刷新 button). */
    async refresh() {
      for (const k in usageCache) delete usageCache[k]
      await this.poll()
      return this.getState()
    },

    /** The payload both the widget and any future read-only caller sees. */
    async getState() {
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
        locale: hostLocale,
        // Local persistence problems (unreadable/corrupt file, failed save) are
        // reported separately from upstream API failures so the panel can say which
        // one happened instead of showing an empty history without explanation.
        storageError: stateStore.loadError || stateStore.saveError || null,
      }
    },

    /**
     * User-only: store new credentials (or clear them). Validated by
     * validateApiKeyForSave() — the API-key shape check runs only on a value the
     * user just submitted, never on what is already in the file.
     * @param input - `{ apiKey, platformToken, clear }` from parseConfigRequest().
     */
    async setConfig(input) {
      if (input.apiKey !== null) state.apiKey = validateApiKeyForSave(input.apiKey)
      if (input.platformToken !== null) state.platformToken = normalizeToken(input.platformToken)
      if (input.clear) {
        state.apiKey = ''
        state.platformToken = ''
        lastBalance = null
      }
      for (const k in usageCache) delete usageCache[k]
      save()
      await this.poll()
      const payload = await this.getState()
      if (input.ignored && input.ignored.length) payload.ignoredFields = input.ignored
      return payload
    },

    /**
     * User-only: switch the visible window.
     * @param input - `{ id, fromMs }` from parseWindowRequest().
     */
    async setWindow(input) {
      state.settings.window = input.id
      if (input.id === 'custom' && input.fromMs != null) state.settings.customFromMs = input.fromMs
      if (input.id !== 'custom') state.settings.customFromMs = null
      save()
      return this.getState()
    },
  }
}
