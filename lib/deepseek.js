// DeepSeek HTTP client: the official balance endpoint plus the platform's
// private usage endpoints.
//
// Extracted from lib/index.js. Only `node:` builtins are used (the plugin ships
// zero dependencies and cannot resolve @deepseek-ai/* packages), and every
// request sends the browser-ish headers the platform WAF requires — without them
// it answers 429 with an HTML body and JSON.parse fails with "Unexpected token <".
//
// Parsing is separated from fetching (`parseBalance`, `parseCostDays`,
// `parseAmountDays`) so the payload shapes can be unit-tested without network.

/** Default endpoints and timeouts; lib/config.js layers user overrides on top. */
export const API_DEFAULTS = {
  balanceUrl: 'https://api.deepseek.com/user/balance',
  usageCostUrl: 'https://platform.deepseek.com/api/v0/usage/cost',
  usageAmountUrl: 'https://platform.deepseek.com/api/v0/usage/amount',
  requestTimeoutMs: 15000,
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

/**
 * Accept the three shapes a platform token is pasted in: the JSON wrapper
 * `{"value":"…"}`, the JS object literal `{value:"…"}` (single quotes, copied
 * out of DevTools) and a quoted string.
 */
export function normalizeToken(raw) {
  if (!raw) return ''
  let s = String(raw).trim()
  if (s.charAt(0) === '{') {
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

/**
 * GET a URL with a bearer token and decode JSON.
 * @throws Error with a human-readable cause; a 401/403 points at the token.
 */
export async function fetchJson(url, token, timeoutMs = API_DEFAULTS.requestTimeoutMs) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'User-Agent': UA,
      Referer: 'https://platform.deepseek.com/',
      Origin: 'https://platform.deepseek.com',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
    signal: AbortSignal.timeout(timeoutMs),
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

/**
 * Normalise an official /user/balance payload.
 * @throws when the payload is an error envelope or has no balance_infos.
 */
export function parseBalance(json) {
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

/** Fetch and normalise the official balance. */
export async function fetchBalance(apiKey, options = {}) {
  const url = options.balanceUrl || API_DEFAULTS.balanceUrl
  const json = await fetchJson(url, apiKey, options.requestTimeoutMs)
  return parseBalance(json)
}

/** The usage endpoints wrap their payload in `data.biz_data`, which may be an object or an array. */
export function pickDataRoot(json) {
  const d = json && json.data
  if (!d) return null
  const root = d.biz_data
  if (Array.isArray(root)) return root[0] || null
  if (root && typeof root === 'object') return root
  return null
}

/** Detect the platform's own error envelopes (top-level `code` and `data.biz_code`). */
function usageErrorOf(json) {
  if (json && typeof json.code === 'number' && json.code !== 0) return json.msg || ('code ' + json.code)
  const d = json && json.data
  if (d && typeof d.biz_code === 'number' && d.biz_code !== 0) return d.biz_msg || ('biz_code ' + d.biz_code)
  return null
}

/**
 * Extract per-day spend (and per-model split) from a /usage/cost payload.
 * @returns `[{ date, cost, models }]`.
 */
export function parseCostDays(json) {
  const root = pickDataRoot(json)
  const days = []
  if (!root || !Array.isArray(root.days)) return days
  for (const day of root.days) {
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
    days.push({ date: day.date, cost, models })
  }
  return days
}

/**
 * Extract per-day token counts from a /usage/amount payload.
 * @returns `[{ date, hit, miss, out }]`.
 */
export function parseAmountDays(json) {
  const days = []
  const root = pickDataRoot(json)
  if (!root || !Array.isArray(root.days)) return days
  for (const day of root.days) {
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
    days.push({ date: day.date, hit, miss, out })
  }
  return days
}

/**
 * Fetch one month of usage. Cost is required (its failure is thrown); the token
 * endpoint is best-effort and its failure is reported as `amountError`.
 * @returns `{ costDays, amountDays, amountError }`.
 */
export async function fetchMonthData(year, month, token, options = {}) {
  const timeoutMs = options.requestTimeoutMs || API_DEFAULTS.requestTimeoutMs
  const costUrl = options.usageCostUrl || API_DEFAULTS.usageCostUrl
  const amountUrl = options.usageAmountUrl || API_DEFAULTS.usageAmountUrl
  const costJson = await fetchJson(`${costUrl}?month=${month}&year=${year}`, token, timeoutMs)
  let amountJson = null
  let amountError = null
  try {
    amountJson = await fetchJson(`${amountUrl}?month=${month}&year=${year}`, token, timeoutMs)
  } catch (err) {
    amountError = String((err && err.message) || err)
  }

  const costError = usageErrorOf(costJson)
  if (costError) throw new Error('用量接口: ' + costError)

  const costDays = parseCostDays(costJson)
  let amountDays = []
  if (amountJson) {
    const err = usageErrorOf(amountJson)
    if (err) amountError = err
    else amountDays = parseAmountDays(amountJson)
  }
  return { costDays, amountDays, amountError }
}
