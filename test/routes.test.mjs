// Unit tests for the /dsbal/* request validation in lib/validate.js.
//
// The validators are pure and live in their own module, so this suite imports
// them directly instead of slicing source text out of lib/index.js.
// Run: node test/routes.test.mjs
//
// Regression this file exists for: /dsbal/window used to fall back to 'today'
// whenever the id was missing or unknown, so probing the route with an empty
// body silently overwrote the user's window setting.
// A missing/unknown id must now be a 400, never a state change. The bounds
// (fromMs age/future, credential length, API-key shape) are the second half:
// they stop a caller from driving unbounded upstream usage requests or writing
// oversized blobs into the state file.

import {
  MAX_API_KEY_LEN,
  MAX_CUSTOM_AGE_MS,
  MAX_TOKEN_LEN,
  WINDOW_IDS,
  parseConfigRequest,
  parseWindowRequest,
  validateApiKeyForSave,
} from '../lib/validate.js'

const NOW = 1758700000000

let failed = 0
let passed = 0

function ok(name, fn) {
  try {
    fn()
    passed++
  } catch (error) {
    failed++
    console.error(`✗ ${name}\n    ${error.message}`)
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg)
}
const throws = (fn, needle) => {
  let threw = null
  try {
    fn()
  } catch (error) {
    threw = error
  }
  assert(threw !== null, 'expected a throw, but the call succeeded')
  if (needle) assert(String(threw.message).includes(needle), `message "${threw.message}" does not contain "${needle}"`)
}

// ------------------------------------------------------- the original incident
ok('window: 空 body 抛错，绝不回退成 today（回归）', () => {
  throws(() => parseWindowRequest('', NOW), 'window:')
  throws(() => parseWindowRequest('{}', NOW), 'window:')
  throws(() => parseWindowRequest(null, NOW), 'window:')
})
ok('window: 未知 id 抛错并列出合法值', () => {
  throws(() => parseWindowRequest('{"id":"month"}', NOW), 'window:')
  try {
    parseWindowRequest('{"id":"month"}', NOW)
  } catch (error) {
    for (const id of WINDOW_IDS) assert(error.message.includes(id), `错误信息未列出 ${id}`)
  }
})
ok('window: id 非字符串（数字/布尔/数组）一律抛错', () => {
  throws(() => parseWindowRequest('{"id":24}', NOW))
  throws(() => parseWindowRequest('{"id":true}', NOW))
  throws(() => parseWindowRequest('{"id":["today"]}', NOW))
})

// ------------------------------------------------------------- valid requests
ok('window: 四个合法 id 原样通过', () => {
  for (const id of WINDOW_IDS) {
    const got = parseWindowRequest(JSON.stringify({ id }), NOW)
    assert(got.id === id, `id ${id} 未正确返回`)
    assert(got.fromMs === null, `${id} 的 fromMs 应为 null`)
  }
})
ok('window: custom + 范围内的数字 fromMs 通过', () => {
  const fromMs = NOW - 86400000
  const got = parseWindowRequest(JSON.stringify({ id: 'custom', fromMs }), NOW)
  assert(got.id === 'custom', 'id 应为 custom')
  assert(got.fromMs === fromMs, 'fromMs 未透传')
})
ok('window: custom 不带 fromMs 合法（等用户选日期）', () => {
  const got = parseWindowRequest('{"id":"custom"}', NOW)
  assert(got.fromMs === null, 'fromMs 应为 null')
})
ok('window: fromMs 类型错误抛错（字符串/NaN/null/布尔）', () => {
  throws(() => parseWindowRequest('{"id":"custom","fromMs":"2026-01-01"}', NOW), 'fromMs')
  throws(() => parseWindowRequest('{"id":"custom","fromMs":null}', NOW), 'fromMs')
  throws(() => parseWindowRequest('{"id":"custom","fromMs":true}', NOW), 'fromMs')
})

// ------------------------------------------- bounds: no unbounded upstream work
ok('window: fromMs 不能晚于当前时间（防未来值）', () => {
  throws(() => parseWindowRequest(JSON.stringify({ id: 'custom', fromMs: NOW + 1 }), NOW), '不能晚于当前时间')
  assert(parseWindowRequest(JSON.stringify({ id: 'custom', fromMs: NOW }), NOW).fromMs === NOW, 'fromMs = now 应通过')
})
ok('window: fromMs 最早 90 天前（边界含端点，防诱发海量用量请求）', () => {
  const oldest = NOW - MAX_CUSTOM_AGE_MS
  assert(parseWindowRequest(JSON.stringify({ id: 'custom', fromMs: oldest }), NOW).fromMs === oldest, '恰好 90 天前应通过')
  throws(() => parseWindowRequest(JSON.stringify({ id: 'custom', fromMs: oldest - 1 }), NOW), '最早为 90 天前')
  throws(() => parseWindowRequest('{"id":"custom","fromMs":0}', NOW), '最早为 90 天前')
})


// ------------------------------------------------------------- malformed body
ok('window/config: 非法 JSON 给出可读错误', () => {
  throws(() => parseWindowRequest('not json', NOW), '不是合法 JSON')
  throws(() => parseConfigRequest('{oops'), '不是合法 JSON')
})
ok('window/config: 非对象 body（数组/标量）抛错', () => {
  for (const body of ['[]', 'null', '"today"', '24', 'true']) {
    throws(() => parseWindowRequest(body, NOW), '应为 JSON 对象')
  }
  throws(() => parseConfigRequest('[]'), '应为 JSON 对象')
})

// -------------------------------------------------------------------- config
ok('config: 空 body / {} 是无字段的空操作', () => {
  for (const body of ['', '{}', null]) {
    const got = parseConfigRequest(body)
    assert(got.apiKey === null && got.platformToken === null, '不应产生任何字段')
    assert(got.clear === false, 'clear 应为 false')
    assert(Array.isArray(got.ignored) && got.ignored.length === 0, 'ignored 应为空数组')
  }
})
ok('config: apiKey / platformToken 原样透传（normalizeToken 在 handler 里做）', () => {
  const got = parseConfigRequest('{"apiKey":" sk-abc ","platformToken":"{value: \\"tok\\"}"}')
  assert(got.apiKey === ' sk-abc ', 'apiKey 不应在此处 trim')
  assert(got.platformToken === '{value: "tok"}', 'platformToken 应原样透传')
})
ok('config: 未知字段被报告而非静默丢弃', () => {
  const got = parseConfigRequest('{"apiKey":"sk-a","junk":1,"typo":true}')
  assert(got.ignored.length === 2 && got.ignored.includes('junk') && got.ignored.includes('typo'), `ignored = ${JSON.stringify(got.ignored)}`)
})
ok('config: 已知字段类型错误抛错（避免"看起来成功了"）', () => {
  throws(() => parseConfigRequest('{"apiKey":123}'), 'apiKey')
  throws(() => parseConfigRequest('{"platformToken":{}}'), 'platformToken')
  throws(() => parseConfigRequest('{"clear":"yes"}'), 'clear')
})
ok('config: clear 只有布尔 true 才生效', () => {
  assert(parseConfigRequest('{"clear":true}').clear === true, 'true 应生效')
  assert(parseConfigRequest('{"clear":false}').clear === false, 'false 不应生效')
})

// ------------------------------------------------ bounds on credential payloads
ok('config: 凭据字段有长度上限（拒绝超大 blob 落盘）', () => {
  const longKey = 'sk-' + 'a'.repeat(MAX_API_KEY_LEN)
  throws(() => parseConfigRequest(JSON.stringify({ apiKey: longKey })), 'apiKey 过长')
  const longToken = 'x'.repeat(MAX_TOKEN_LEN + 1)
  throws(() => parseConfigRequest(JSON.stringify({ platformToken: longToken })), 'platformToken 过长')
  const okKey = 'sk-' + 'a'.repeat(MAX_API_KEY_LEN - 3)
  assert(parseConfigRequest(JSON.stringify({ apiKey: okKey })).apiKey.length === MAX_API_KEY_LEN, '上限内的 key 应通过')
})
ok('config: 保存时校验 API Key 形态（防把 userToken 粘进 Key 字段）', () => {
  assert(validateApiKeyForSave('') === '', '空值应原样返回（= 清空/不改）')
  assert(validateApiKeyForSave(null) === '', 'null 应视为空')
  assert(validateApiKeyForSave('  sk-abcdefgh1234  ') === 'sk-abcdefgh1234', '合法 key 应 trim 后返回')
  throws(() => validateApiKeyForSave('x'.repeat(64)), 'sk- 开头')
  throws(() => validateApiKeyForSave('sk-short'), 'sk- 开头')
  throws(() => validateApiKeyForSave('Bearer sk-abcdefgh1234'), 'sk- 开头')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
