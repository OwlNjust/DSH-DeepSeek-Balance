// Unit tests for the /dsbal/* request validation in lib/index.js.
//
// Like test/phase.test.mjs, this extracts the real code from lib/index.js —
// between the `// ---- requests:begin` / `// ---- requests:end ----` markers —
// so the tests cannot drift from what ships. Run: node test/routes.test.mjs
//
// Regression this file exists for: /dsbal/window used to fall back to 'today'
// whenever the id was missing or unknown, so probing the route with an empty
// body silently overwrote the user's window setting.
// A missing/unknown id must now be a 400, never a state change.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE = join(HERE, '..', 'lib', 'index.js')

function loadRequests() {
  const src = readFileSync(SOURCE, 'utf8')
  const begin = src.indexOf('// ---- requests:begin')
  const end = src.indexOf('// ---- requests:end ----')
  if (begin < 0 || end < 0 || end <= begin) {
    throw new Error('requests markers not found in lib/index.js — keep the // ---- requests:begin / end ---- comments')
  }
  const block = src.slice(src.indexOf('\n', begin) + 1, end)
  return new Function(block + '\nreturn { parseWindowRequest, parseConfigRequest, WINDOW_IDS }')()
}

const { parseWindowRequest, parseConfigRequest, WINDOW_IDS } = loadRequests()

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
ok('window: 空 body 抛错，绝不回退成 today（回归 #11）', () => {
  throws(() => parseWindowRequest(''), 'window:')
  throws(() => parseWindowRequest('{}'), 'window:')
  throws(() => parseWindowRequest(null), 'window:')
})
ok('window: 未知 id 抛错并列出合法值', () => {
  throws(() => parseWindowRequest('{"id":"month"}'), 'window:')
  try {
    parseWindowRequest('{"id":"month"}')
  } catch (error) {
    for (const id of WINDOW_IDS) assert(error.message.includes(id), `错误信息未列出 ${id}`)
  }
})
ok('window: id 非字符串（数字/布尔/数组）一律抛错', () => {
  throws(() => parseWindowRequest('{"id":24}'))
  throws(() => parseWindowRequest('{"id":true}'))
  throws(() => parseWindowRequest('{"id":["today"]}'))
})

// ------------------------------------------------------------- valid requests
ok('window: 四个合法 id 原样通过', () => {
  for (const id of WINDOW_IDS) {
    const got = parseWindowRequest(JSON.stringify({ id }))
    assert(got.id === id, `id ${id} 未正确返回`)
    assert(got.fromMs === null, `${id} 的 fromMs 应为 null`)
  }
})
ok('window: custom + 数字 fromMs 通过', () => {
  const got = parseWindowRequest('{"id":"custom","fromMs":1758700000000}')
  assert(got.id === 'custom', 'id 应为 custom')
  assert(got.fromMs === 1758700000000, 'fromMs 未透传')
})
ok('window: custom 不带 fromMs 合法（等用户选日期）', () => {
  const got = parseWindowRequest('{"id":"custom"}')
  assert(got.fromMs === null, 'fromMs 应为 null')
})
ok('window: fromMs 类型错误抛错（字符串/NaN/null）', () => {
  throws(() => parseWindowRequest('{"id":"custom","fromMs":"2026-01-01"}'), 'fromMs')
  throws(() => parseWindowRequest('{"id":"custom","fromMs":null}'), 'fromMs')
})

// ------------------------------------------------------------- malformed body
ok('window/config: 非法 JSON 给出可读错误', () => {
  throws(() => parseWindowRequest('not json'), '不是合法 JSON')
  throws(() => parseConfigRequest('{oops'), '不是合法 JSON')
})
ok('window/config: 非对象 body（数组/标量）抛错', () => {
  for (const body of ['[]', 'null', '"today"', '24', 'true']) {
    throws(() => parseWindowRequest(body), '应为 JSON 对象')
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

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
