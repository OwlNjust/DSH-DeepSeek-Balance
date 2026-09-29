// Unit tests for lib/config.js.
//
// The profile patch replaces `config` wholesale, so the important property to
// pin is that resolveConfig starts from DEFAULTS and fills the gaps — a user who
// sets only `pollIntervalMs` must keep every other default.
// Run: node test/config.test.mjs

import { DEFAULTS, apiOptions, resolveConfig } from '../lib/config.js'

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
  if (needle) assert(String(threw.message).includes(needle), `message "${threw.message}" does not include "${needle}"`)
}

ok('config: 无配置 → 全部默认值', () => {
  for (const raw of [undefined, null, {}, 'nonsense', 42]) {
    const c = resolveConfig(raw)
    for (const [k, v] of Object.entries(DEFAULTS)) assert(c[k] === v, `${k} 应为默认值 ${v}`)
  }
})
ok('config: 只覆盖一个字段时，其余保持默认（整体替换语义）', () => {
  const c = resolveConfig({ pollIntervalMs: 900000 })
  assert(c.pollIntervalMs === 900000, 'pollIntervalMs 未生效')
  assert(c.historyDays === DEFAULTS.historyDays, 'historyDays 应保持默认')
  assert(c.balanceUrl === DEFAULTS.balanceUrl, 'balanceUrl 应保持默认')
})
ok('config: 未知字段直接报错并列出可用字段', () => {
  throws(() => resolveConfig({ pollInterval: 1000 }), '未知字段 pollInterval')
  try {
    resolveConfig({ junk: 1 })
  } catch (error) {
    assert(error.message.includes('pollIntervalMs'), '错误信息应列出可用字段')
  }
})
ok('config: 整数范围校验（下界/上界/非整数）', () => {
  throws(() => resolveConfig({ pollIntervalMs: 29_999 }), 'pollIntervalMs')
  throws(() => resolveConfig({ pollIntervalMs: 24 * 3600_000 + 1 }), 'pollIntervalMs')
  throws(() => resolveConfig({ pollIntervalMs: 1.5 }), '必须是整数')
  throws(() => resolveConfig({ historyDays: 0 }), 'historyDays')
  throws(() => resolveConfig({ historyDays: 401 }), 'historyDays')
  throws(() => resolveConfig({ requestTimeoutMs: '15000' }), '必须是整数')
  assert(resolveConfig({ historyDays: 400 }).historyDays === 400, '上界应通过')
  assert(resolveConfig({ historyDays: 1 }).historyDays === 1, '下界应通过')
})
ok('config: 端点必须是 https URL（拒绝 http/空/非字符串）', () => {
  throws(() => resolveConfig({ balanceUrl: 'http://api.deepseek.com/user/balance' }), 'https URL')
  throws(() => resolveConfig({ usageCostUrl: '' }), 'https URL')
  throws(() => resolveConfig({ usageAmountUrl: 42 }), 'https URL')
  assert(resolveConfig({ balanceUrl: 'https://example.test/balance' }).balanceUrl === 'https://example.test/balance', '合法 https 应通过')
})
ok('config: apiOptions 只取 HTTP 客户端需要的四项', () => {
  const opts = apiOptions(resolveConfig({ requestTimeoutMs: 5000 }))
  assert(Object.keys(opts).sort().join(',') === 'balanceUrl,requestTimeoutMs,usageAmountUrl,usageCostUrl', `keys = ${Object.keys(opts).join(',')}`)
  assert(opts.requestTimeoutMs === 5000, 'requestTimeoutMs 未透传')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
