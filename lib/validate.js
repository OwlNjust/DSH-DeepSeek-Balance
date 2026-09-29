// Request validation for the /dsbal/* HTTP surface.
//
// Pure functions with no harness imports, so they can be unit-tested directly
// (test/routes.test.mjs) and reused by any caller (routes today, a Host service
// or a command later). Errors are thrown with a `<scope>: <reason>` message; the
// route layer turns them into a 400 and never mutates state on the way out.
//
// History that matters here: /dsbal/window used to fall back to 'today' for a
// missing or unknown id, so probing the route with an empty body silently
// overwrote the user's window setting. Strict validation is the fix, and the
// bounds below are the second half of it: an unbounded `fromMs` let a caller
// drive an arbitrary number of upstream usage-API requests.

/** Selectable history windows, in the order the client renders them. */
export const WINDOW_IDS = ['today', '24h', '7d', 'custom']

/** Oldest accepted `custom` start: keeps one request inside the retained history. */
export const MAX_CUSTOM_AGE_MS = 90 * 86400000

/** Upper bounds for credential fields — long enough for real tokens, short enough to reject blobs. */
export const MAX_API_KEY_LEN = 256
export const MAX_TOKEN_LEN = 4096

/** Shapes an API key pasted from platform.deepseek.com; used only when the user saves one. */
const API_KEY_PATTERN = /^sk-[A-Za-z0-9_-]{8,}$/

/**
 * Parse a request body into a plain object; empty body → {} ("no fields").
 * @throws when the body is not JSON or not a JSON object.
 */
export function parseJsonBody(raw, what) {
  if (raw == null || raw === '') return {}
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`${what}: 请求体不是合法 JSON`)
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${what}: 请求体应为 JSON 对象`)
  }
  return parsed
}

/**
 * Validate a /dsbal/window request. Deliberately strict: a missing or unknown id
 * is a client bug, and silently falling back to 'today' would overwrite the user's
 * window setting as a side effect — which is what an older revision did when a
 * route probe posted an empty body.
 *
 * `fromMs` is bounded: it may be absent (the user has not picked a date yet), but
 * when present it must be finite, not in the future and not older than
 * MAX_CUSTOM_AGE_MS.
 * @param raw - request body text.
 * @param nowMs - current time, injectable for tests.
 */
export function parseWindowRequest(raw, nowMs = Date.now()) {
  const a = parseJsonBody(raw, 'window')
  if (typeof a.id !== 'string' || !WINDOW_IDS.includes(a.id)) {
    throw new Error(`window: 需要 id 为 ${WINDOW_IDS.join(' / ')} 之一，收到 ${JSON.stringify(a.id)}`)
  }
  if (a.fromMs !== undefined) {
    if (!Number.isFinite(a.fromMs)) {
      throw new Error('window: fromMs 必须是数字（毫秒时间戳）')
    }
    if (a.fromMs > nowMs) {
      throw new Error('window: fromMs 不能晚于当前时间')
    }
    if (a.fromMs < nowMs - MAX_CUSTOM_AGE_MS) {
      throw new Error(`window: fromMs 最早为 ${MAX_CUSTOM_AGE_MS / 86400000} 天前`)
    }
  }
  return { id: a.id, fromMs: typeof a.fromMs === 'number' ? a.fromMs : null }
}

/**
 * Validate a /dsbal/config request. Unknown keys are reported back instead of
 * being dropped silently; wrong-typed known keys are an error rather than a
 * silent no-op (a typo'd client would otherwise look like it worked).
 *
 * Length caps only — no format check here, because this path also has to accept
 * whatever is already in the state file. The stricter "looks like an API key"
 * check belongs to validateApiKeyForSave() and runs when the user saves.
 */
export function parseConfigRequest(raw) {
  const a = parseJsonBody(raw, 'config')
  const known = ['apiKey', 'platformToken', 'clear']
  const ignored = Object.keys(a).filter((k) => !known.includes(k))
  if (a.apiKey !== undefined && typeof a.apiKey !== 'string') throw new Error('config: apiKey 必须是字符串')
  if (a.platformToken !== undefined && typeof a.platformToken !== 'string') throw new Error('config: platformToken 必须是字符串')
  if (a.clear !== undefined && typeof a.clear !== 'boolean') throw new Error('config: clear 必须是布尔值')
  if (typeof a.apiKey === 'string' && a.apiKey.length > MAX_API_KEY_LEN) {
    throw new Error(`config: apiKey 过长（上限 ${MAX_API_KEY_LEN} 字符）`)
  }
  if (typeof a.platformToken === 'string' && a.platformToken.length > MAX_TOKEN_LEN) {
    throw new Error(`config: platformToken 过长（上限 ${MAX_TOKEN_LEN} 字符）`)
  }
  return {
    apiKey: typeof a.apiKey === 'string' ? a.apiKey : null,
    platformToken: typeof a.platformToken === 'string' ? a.platformToken : null,
    clear: a.clear === true,
    ignored,
  }
}

/**
 * Catch the classic paste mistake before it is written to disk: a DeepSeek API
 * key starts with `sk-`, a platform userToken does not. Only applied to a value
 * the user just submitted (never to values already in the state file).
 * @throws with a message that says which field looks wrong.
 */
export function validateApiKeyForSave(value) {
  const key = String(value == null ? '' : value).trim()
  if (key === '') return key
  if (!API_KEY_PATTERN.test(key)) {
    throw new Error('config: apiKey 应以 sk- 开头（请确认粘贴的是 platform.deepseek.com 的 API Key，而不是 userToken）')
  }
  return key
}
