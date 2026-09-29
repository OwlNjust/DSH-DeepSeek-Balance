// Unit tests for the window/pure-aggregation functions in lib/window.js.
//
// These cover the parts that decide what the user sees as "spend": the range a
// window resolves to (Beijing midnight boundaries), the balance-snapshot estimate
// (top-ups must not count as consumption) and the monthly usage summing (date
// filtering, per-model totals, token-error propagation).
// Run: node test/window.test.mjs

import { monthRange, spentFromSnapshots, sumMonths, windowOf } from '../lib/window.js'

const BJ = 8 * 3600 * 1000
// 2026-09-29 14:00 Beijing = 06:00 UTC
const NOW = Date.parse('2026-09-29T06:00:00Z')
const bj = (s) => Date.parse(s + '+08:00')

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
const eq = (got, want, what) => assert(got === want, `${what}: got ${got}, want ${want}`)

// ------------------------------------------------------------------- windowOf
ok('windowOf: today 从北京 0 点起算', () => {
  const w = windowOf({ window: 'today' }, NOW, BJ)
  eq(w.id, 'today', 'id')
  eq(w.fromMs, bj('2026-09-29T00:00:00'), 'fromMs')
  eq(w.toMs, NOW, 'toMs')
})
ok('windowOf: 24h / 7d 为滚动窗口', () => {
  eq(windowOf({ window: '24h' }, NOW, BJ).fromMs, NOW - 86400000, '24h fromMs')
  eq(windowOf({ window: '7d' }, NOW, BJ).fromMs, NOW - 7 * 86400000, '7d fromMs')
})
ok('windowOf: custom 透传 fromMs，缺省为 null', () => {
  eq(windowOf({ window: 'custom', customFromMs: 123 }, NOW, BJ).fromMs, 123, 'custom fromMs')
  eq(windowOf({ window: 'custom' }, NOW, BJ).fromMs, null, 'custom 缺省')
})
ok('windowOf: 未知/缺失设置回退 today', () => {
  eq(windowOf({}, NOW, BJ).id, 'today', '空 settings')
  eq(windowOf(null, NOW, BJ).id, 'today', 'null settings')
})
ok('windowOf: 北京 0 点边界（UTC 16:00 前后分属不同日）', () => {
  const justBefore = Date.parse('2026-09-29T15:59:00Z') // 北京 09-29 23:59
  const justAfter = Date.parse('2026-09-29T16:01:00Z') // 北京 09-30 00:01
  eq(windowOf({ window: 'today' }, justBefore, BJ).fromMs, bj('2026-09-29T00:00:00'), '23:59 的日界')
  eq(windowOf({ window: 'today' }, justAfter, BJ).fromMs, bj('2026-09-30T00:00:00'), '00:01 的日界')
})

// ------------------------------------------------------- spentFromSnapshots
ok('spentFromSnapshots: 无快照返回 null', () => {
  eq(spentFromSnapshots([], NOW - 1000, NOW), null, '空数组')
  eq(spentFromSnapshots(null, NOW - 1000, NOW), null, 'null')
})
ok('spentFromSnapshots: 累加下降额，忽略充值（上升）', () => {
  const snaps = [
    { t: bj('2026-09-29T08:00:00'), total: 10 }, // 窗口起点之前，让估算覆盖整个窗口
    { t: bj('2026-09-29T10:00:00'), total: 10 },
    { t: bj('2026-09-29T11:00:00'), total: 8 }, // -2 消耗
    { t: bj('2026-09-29T12:00:00'), total: 20 }, // 充值，不计
    { t: bj('2026-09-29T13:00:00'), total: 19 }, // -1 消耗
  ]
  const got = spentFromSnapshots(snaps, bj('2026-09-29T09:00:00'), bj('2026-09-29T14:00:00'))
  eq(got.spent, 3, 'spent')
  eq(got.partial, false, 'partial')
})
ok('spentFromSnapshots: 窗口早于首个快照 → partial 标记', () => {
  const snaps = [
    { t: bj('2026-09-29T10:00:00'), total: 10 },
    { t: bj('2026-09-29T11:00:00'), total: 9 },
  ]
  const got = spentFromSnapshots(snaps, bj('2026-09-20T00:00:00'), bj('2026-09-29T12:00:00'))
  eq(got.spent, 1, 'spent')
  eq(got.partial, true, 'partial')
})
ok('spentFromSnapshots: 快照全在窗口之后 → 0 且 partial', () => {
  const snaps = [{ t: bj('2026-10-01T10:00:00'), total: 5 }]
  const got = spentFromSnapshots(snaps, bj('2026-09-01T00:00:00'), bj('2026-09-02T00:00:00'))
  eq(got.spent, 0, 'spent')
  eq(got.partial, true, 'partial')
})

// ------------------------------------------------------------- monthRange
ok('monthRange: 同日 → 单月，日期键为北京日历日', () => {
  const r = monthRange(bj('2026-09-29T00:00:00'), bj('2026-09-29T14:00:00'), BJ)
  eq(r.fromDate, '2026-09-29', 'fromDate')
  eq(r.toDate, '2026-09-29', 'toDate')
  eq(r.months.length, 1, '月数')
  eq(r.months[0].year, 2026, 'year')
  eq(r.months[0].month, 9, 'month')
})
ok('monthRange: 跨月 → 按序列出（含跨年）', () => {
  const r = monthRange(bj('2026-12-30T00:00:00'), bj('2027-01-02T00:00:00'), BJ)
  eq(r.months.map((m) => `${m.year}-${m.month}`).join(','), '2026-12,2027-1', '月份序列')
})

// -------------------------------------------------------------- sumMonths
const entry = {
  costDays: [
    { date: '2026-09-28', cost: 1.5, models: { 'deepseek-flash': 1.5 } },
    { date: '2026-09-29', cost: 2.5, models: { 'deepseek-flash': 1.0, 'deepseek-v4-pro': 1.5 } },
    { date: '2026-09-30', cost: 9.9, models: { 'deepseek-v4-pro': 9.9 } }, // 窗口外
  ],
  amountDays: [
    { date: '2026-09-29', hit: 100, miss: 20, out: 5 },
    { date: '2026-09-30', hit: 999, miss: 999, out: 999 },
  ],
  amountError: null,
}
ok('sumMonths: 只累计窗口内日期，并按模型降序汇总', () => {
  const r = sumMonths([entry], { fromDate: '2026-09-28', toDate: '2026-09-29' })
  eq(r.total, 4, 'total')
  eq(r.models.length, 2, '模型数')
  eq(r.models[0].model, 'deepseek-flash', '最大模型')
  eq(r.models[0].cost, 2.5, 'flash 合计（1.5 + 1.0）')
  eq(r.models[1].cost, 1.5, 'v4-pro 合计')
  eq(r.tokens.hit, 100, 'hit')
  eq(r.tokens.miss, 20, 'miss')
  eq(r.tokens.out, 5, 'out')
  eq(r.tokens.total, 125, 'token 合计')
  eq(r.tokenError, null, 'tokenError')
})
ok('sumMonths: token 接口失败时 tokens=null 并带出原因', () => {
  const broken = { costDays: [{ date: '2026-09-29', cost: 1, models: {} }], amountDays: [], amountError: '令牌失效' }
  const r = sumMonths([broken], { fromDate: '2026-09-28', toDate: '2026-09-29' })
  eq(r.total, 1, 'total 仍可用')
  eq(r.tokens, null, 'tokens')
  eq(r.tokenError, '令牌失效', 'tokenError')
})
ok('sumMonths: 多月求和 + 跳过空条目', () => {
  const a = { costDays: [{ date: '2026-08-31', cost: 3, models: {} }], amountDays: [], amountError: null }
  const b = { costDays: [{ date: '2026-09-01', cost: 4, models: {} }], amountDays: [{ date: '2026-09-01', hit: 1, miss: 2, out: 3 }], amountError: null }
  const r = sumMonths([a, null, b], { fromDate: '2026-08-31', toDate: '2026-09-01' })
  eq(r.total, 7, 'total')
  eq(r.tokens.total, 6, 'token 合计')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
