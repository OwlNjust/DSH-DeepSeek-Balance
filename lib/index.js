// dsh-deepseek-balance — host half.
//
// A static Cordis plugin for the deepseek-harness web profile:
//   * polls the DeepSeek balance endpoint (and, when a platform userToken is
//     configured, the private usage endpoints) every 5 minutes,
//   * persists keys and balance snapshots to ~/.deepseek-balance.json,
//   * serves the widget via same-origin /dsbal/* HTTP routes on the harness
//     web server (the browser client module consumes them with fetch()).
//
// The browser half is registered automatically because this package declares
// `dsh.client` in package.json (see repository README for installation).

import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const FILE_NAME = '.deepseek-balance.json'
const POLL_MS = 5 * 60 * 1000
const HISTORY_DAYS = 90
const USAGE_TTL_MS = 60 * 60 * 1000
const USAGE_ERR_TTL_MS = 10 * 60 * 1000
const BJ_OFFSET = 8 * 3600 * 1000
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const BALANCE_URL = 'https://api.deepseek.com/user/balance'
const USAGE_COST_URL = 'https://platform.deepseek.com/api/v0/usage/cost'
const USAGE_AMOUNT_URL = 'https://platform.deepseek.com/api/v0/usage/amount'

function normalizeToken(raw) {
  if (!raw) return ''
  let s = String(raw).trim()
  if (s.charAt(0) === '{') {
    // Object wrapper from the platform page (JSON: {"value": "…"} or a JS
    // object literal: {value: "…"} as pasted from DevTools/localStorage).
    try {
      const obj = JSON.parse(s)
      if (obj && typeof obj.value === 'string') s = obj.value
    } catch {
      const m = /value["']?\s*[:=]\s*"([^"]+)"/.exec(s)
      if (m) s = m[1]
    }
  }
  if (s.length > 1 && s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') {
    try {
      const parsed = JSON.parse(s)
      if (typeof parsed === 'string') s = parsed
    } catch { /* keep original */ }
  }
  return s.trim()
}

export default {
  inject: ['timer', 'webServer'],
  async apply(ctx) {
    const timer = ctx.timer
    const webServer = ctx.webServer
    const stateFile = join(process.env.DSH_HOME || homedir(), FILE_NAME)

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
      store.settings.window = ['today', '24h', '7d', 'custom'].includes(store.settings.window) ? store.settings.window : 'today'
      store.settings.customFromMs = typeof store.settings.customFromMs === 'number' ? store.settings.customFromMs : null
    }

    async function saveStore() {
      try {
        await writeFile(stateFile, JSON.stringify(store), { mode: 0o600 })
      } catch (err) {
        console.error('[dsbal] save failed', err && err.message ? err.message : err)
      }
    }

    async function fetchJson(url, token) {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'User-Agent': UA,
          Referer: 'https://platform.deepseek.com/',
          Origin: 'https://platform.deepseek.com',
          'Accept-Language': 'zh-CN,zh;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) {
        let hint = ''
        try {
          const text = await res.text()
          hint = text.slice(0, 160).replace(/\s+/g, ' ')
        } catch { /* ignore */ }
        if (res.status === 401 || res.status === 403) {
          throw new Error('平台令牌失效或权限不足（HTTP ' + res.status + '），请重新登录 platform.deepseek.com 获取新 userToken' + (hint ? ' · ' + hint : ''))
        }
        throw new Error('HTTP 请求失败（' + res.status + '）' + (hint ? ' · ' + hint : ''))
      }
      return res.json()
    }

    async function fetchBalance() {
      const json = await fetchJson(BALANCE_URL, store.apiKey)
      if (json && json.error) throw new Error(String((json.error && json.error.message) || '余额接口错误：请检查 API Key 是否正确或已过期'))
      if (!json || !Array.isArray(json.balance_infos) || !json.balance_infos.length) throw new Error('余额接口返回格式异常')
      const info = json.balance_infos[0]
      return {
        currency: info.currency || 'CNY',
        total: parseFloat(info.total_balance) || 0,
        toppedUp: parseFloat(info.topped_up_balance) || 0,
        granted: parseFloat(info.granted_balance) || 0,
        available: !!json.is_available,
      }
    }

    function pickDataRoot(json) {
      const d = json && json.data
      if (!d) return null
      const root = d.biz_data
      if (Array.isArray(root)) return root[0] || null
      if (root && typeof root === 'object') return root
      return null
    }

    async function fetchMonthData(year, month) {
      const token = store.platformToken
      const costJson = await fetchJson(`${USAGE_COST_URL}?month=${month}&year=${year}`, token)
      let amountJson = null
      let amountError = null
      try {
        amountJson = await fetchJson(`${USAGE_AMOUNT_URL}?month=${month}&year=${year}`, token)
      } catch (err) {
        amountError = String((err && err.message) || err)
      }

      if (costJson && typeof costJson.code === 'number' && costJson.code !== 0) {
        throw new Error('用量接口: ' + (costJson.msg || ('code ' + costJson.code)))
      }
      const cd = costJson && costJson.data
      if (cd && typeof cd.biz_code === 'number' && cd.biz_code !== 0) {
        throw new Error('用量接口: ' + (cd.biz_msg || ('biz_code ' + cd.biz_code)))
      }

      const costRoot = pickDataRoot(costJson)
      const costDays = []
      if (costRoot && Array.isArray(costRoot.days)) {
        for (const day of costRoot.days) {
          if (!day || typeof day.date !== 'string') continue
          let cost = 0
          const models = {}
          const data = Array.isArray(day.data) ? day.data : []
          for (const m of data) {
            if (!m || !Array.isArray(m.usage)) continue
            let mc = 0
            for (const u of m.usage) {
              if (u && typeof u.amount === 'string') {
                const v = parseFloat(u.amount) || 0
                cost += v
                mc += v
              }
            }
            if (m.model && mc > 0) models[m.model] = mc
          }
          costDays.push({ date: day.date, cost, models })
        }
      }

      const amountDays = []
      if (amountJson) {
        try {
          if (typeof amountJson.code === 'number' && amountJson.code !== 0) amountError = amountJson.msg || ('code ' + amountJson.code)
          else {
            const ad = amountJson.data
            if (ad && typeof ad.biz_code === 'number' && ad.biz_code !== 0) amountError = ad.biz_msg || ('biz_code ' + ad.biz_code)
            else {
              const amountRoot = pickDataRoot(amountJson)
              if (amountRoot && Array.isArray(amountRoot.days)) {
                for (const day of amountRoot.days) {
                  if (!day || typeof day.date !== 'string') continue
                  let hit = 0
                  let miss = 0
                  let out = 0
                  const data = Array.isArray(day.data) ? day.data : []
                  for (const m of data) {
                    if (!m || !Array.isArray(m.usage)) continue
                    for (const u of m.usage) {
                      if (!u || typeof u.amount !== 'string') continue
                      const v = parseFloat(u.amount) || 0
                      if (u.type === 'PROMPT_CACHE_HIT_TOKEN') hit += v
                      else if (u.type === 'PROMPT_CACHE_MISS_TOKEN') miss += v
                      else if (u.type === 'RESPONSE_TOKEN') out += v
                    }
                  }
                  amountDays.push({ date: day.date, hit, miss, out })
                }
              }
            }
          }
        } catch (err) {
          amountError = String((err && err.message) || err)
        }
      }

      return { costDays, amountDays, amountError }
    }

    function phaseInfo(nowMs) {
      const shifted = nowMs + BJ_OFFSET
      const dayStartShifted = Math.floor(shifted / 86400000) * 86400000
      const dayStartMs = dayStartShifted - BJ_OFFSET
      const B = [0, 540, 720, 840, 1080, 1440] // Beijing 0:00 9:00 12:00 14:00 18:00 24:00
      // Official pricing: peak = Beijing Mon–Fri 09:00–12:00, 14:00–18:00
      // (weekends are off-peak all day); off-peak price = 50% of peak.
      // Segments are merged across same-mode boundaries, so the weekend is one
      // continuous 梁文谷 segment from Friday 18:00 to Monday 09:00.
      const events = []
      for (let dayOff = -3; dayOff <= 4; dayOff++) {
        const dayS = dayStartMs + dayOff * 86400000
        // UTC fields of the shifted date equal Beijing fields.
        const wd = new Date(dayStartShifted + dayOff * 86400000).getUTCDay()
        const weekend = wd === 0 || wd === 6
        for (let i = 0; i < 6; i++) {
          const kind = weekend || (i !== 1 && i !== 3) ? 'valley' : 'peak'
          events.push({ t: dayS + B[i] * 60000, kind })
        }
      }
      events.sort((a, b) => a.t - b.t)
      // Keep only mode flips: consecutive same-kind boundaries collapse into one.
      const flips = []
      for (const ev of events) {
        if (!flips.length || flips[flips.length - 1].kind !== ev.kind) flips.push(ev)
      }
      let seg = null
      for (let i = 0; i < flips.length; i++) {
        if (flips[i].t <= nowMs) {
          seg = {
            t: flips[i].t,
            kind: flips[i].kind,
            end: i + 1 < flips.length ? flips[i + 1].t : nowMs + 86400000,
          }
        }
      }
      if (!seg) seg = { t: nowMs, end: nowMs, kind: 'valley' }
      const peak = seg.kind === 'peak'
      return {
        mode: seg.kind,
        label: peak ? '梁文峰' : '梁文谷',
        startMs: seg.t,
        endMs: seg.end,
        note: peak
          ? '高峰时段（北京时间周一至周五 09:00-12:00、14:00-18:00）：价格是空闲时段的 2 倍，请减少 API 调用！'
          : '空闲时段（其余时间，含周末全天）：价格为高峰的 50%（半价），适合集中调用。',
      }
    }

    function windowOf(nowMs) {
      const id = store.settings.window
      if (id === 'custom') {
        return { id: 'custom', fromMs: typeof store.settings.customFromMs === 'number' ? store.settings.customFromMs : null, toMs: nowMs }
      }
      if (id === '24h') return { id: '24h', fromMs: nowMs - 86400000, toMs: nowMs }
      if (id === '7d') return { id: '7d', fromMs: nowMs - 7 * 86400000, toMs: nowMs }
      const shifted = nowMs + BJ_OFFSET
      const dayStartMs = Math.floor(shifted / 86400000) * 86400000 - BJ_OFFSET
      return { id: 'today', fromMs: dayStartMs, toMs: nowMs }
    }

    function spentFromSnapshots(fromMs, toMs) {
      const snaps = store.snapshots
      if (!snaps.length) return null
      let baseIdx = -1
      let endIdx = -1
      for (let i = 0; i < snaps.length; i++) {
        if (snaps[i].t <= fromMs) baseIdx = i
        if (snaps[i].t <= toMs) endIdx = i
      }
      if (endIdx < 0) return { spent: 0, partial: true }
      let spent = 0
      const start = baseIdx >= 0 ? baseIdx : 0
      for (let i = start; i < endIdx; i++) {
        const a = snaps[i]
        const b = snaps[i + 1]
        const ta = typeof a.total === 'number' ? a.total : null
        const tb = typeof b.total === 'number' ? b.total : null
        if (ta != null && tb != null && tb < ta) spent += ta - tb
      }
      return { spent, partial: baseIdx < 0 }
    }

    async function loadMonth(y, m) {
      const key = `${y}-${m}`
      let entry = usageCache[key]
      const now = Date.now()
      const ttl = entry && entry.error ? USAGE_ERR_TTL_MS : USAGE_TTL_MS
      if (!entry || now - entry.fetchedAtMs > ttl) {
        try {
          const res = await fetchMonthData(y, m)
          entry = { costDays: res.costDays, amountDays: res.amountDays, amountError: res.amountError, fetchedAtMs: now }
        } catch (err) {
          entry = { error: String((err && err.message) || err), fetchedAtMs: now }
        }
        usageCache[key] = entry
      }
      return entry
    }

    async function officialWindow(fromMs, toMs) {
      if (fromMs == null) return null
      const start = new Date(fromMs + BJ_OFFSET)
      const end = new Date(toMs + BJ_OFFSET)
      const fromDate = start.toISOString().slice(0, 10)
      const toDate = end.toISOString().slice(0, 10)
      let y = start.getUTCFullYear()
      let m = start.getUTCMonth() + 1
      const endY = end.getUTCFullYear()
      const endM = end.getUTCMonth() + 1
      let total = 0
      const modelTotals = {}
      let hit = 0
      let miss = 0
      let out = 0
      let amountError = null
      let guard = 0
      while ((y < endY || (y === endY && m <= endM)) && guard < 24) {
        guard++
        const entry = await loadMonth(y, m)
        if (entry.error) throw new Error(entry.error)
        for (const day of entry.costDays) {
          if (day.date >= fromDate && day.date <= toDate) {
            total += day.cost
            if (day.models) {
              for (const mn in day.models) modelTotals[mn] = (modelTotals[mn] || 0) + day.models[mn]
            }
          }
        }
        if (entry.amountError) amountError = entry.amountError
        else {
          for (const day of entry.amountDays) {
            if (day.date >= fromDate && day.date <= toDate) {
              hit += day.hit
              miss += day.miss
              out += day.out
            }
          }
        }
        m++
        if (m > 12) { m = 1; y++ }
      }
      const models = []
      for (const mn in modelTotals) models.push({ model: mn, cost: modelTotals[mn] })
      models.sort((a, b) => b.cost - a.cost)
      return {
        total,
        models,
        tokens: amountError ? null : { hit, miss, out, total: hit + miss + out },
        tokenError: amountError,
      }
    }

    async function computeWindow(nowMs) {
      const w = windowOf(nowMs)
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
        const est = store.apiKey ? spentFromSnapshots(w.fromMs, w.toMs) : null
        if (est) {
          spent = est.spent
          partial = est.partial
          source = 'estimate'
        }
      }
      return { id: w.id, fromMs: w.fromMs, toMs: w.toMs, spent, source, partial, usageError, models, tokens, tokenError }
    }

    async function poll() {
      if (busy || !store) return
      busy = true
      try {
        if (store.apiKey) {
          const b = await fetchBalance()
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

    // ---- same-origin HTTP surface ----
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
    function registerRoute(path, handler) {
      return webServer.register({ kind: 'exact', path, handler })
    }

    await loadStore()
    await saveStore()
    void poll()

    const disposers = [
      registerRoute('/dsbal/state', async (req, res) => {
        try {
          sendJson(res, 200, await buildState())
        } catch (err) {
          sendJson(res, 500, { error: String((err && err.message) || err) })
        }
      }),
      registerRoute('/dsbal/refresh', async (req, res) => {
        for (const k in usageCache) delete usageCache[k]
        await poll()
        sendJson(res, 200, await buildState())
      }),
      registerRoute('/dsbal/config', async (req, res) => {
        try {
          const raw = await readBody(req)
          const a = raw ? JSON.parse(raw) : {}
          if (typeof a.apiKey === 'string') store.apiKey = a.apiKey.trim()
          if (typeof a.platformToken === 'string') store.platformToken = normalizeToken(a.platformToken)
          if (a.clear === true) {
            store.apiKey = ''
            store.platformToken = ''
            lastBalance = null
          }
          for (const k in usageCache) delete usageCache[k]
          await saveStore()
          await poll()
          sendJson(res, 200, await buildState())
        } catch (err) {
          sendJson(res, 400, { error: String((err && err.message) || err) })
        }
      }),
      registerRoute('/dsbal/window', async (req, res) => {
        try {
          const raw = await readBody(req)
          const a = raw ? JSON.parse(raw) : {}
          const id = ['today', '24h', '7d', 'custom'].includes(a.id) ? a.id : 'today'
          store.settings.window = id
          if (id === 'custom' && typeof a.fromMs === 'number') store.settings.customFromMs = a.fromMs
          if (id !== 'custom') store.settings.customFromMs = null
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
