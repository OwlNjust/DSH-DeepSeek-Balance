// Unit tests for the peak/valley price-phase algorithm in lib/index.js.
//
// The phase code is extracted verbatim from lib/index.js between the
// `// ---- phase:begin` / `// ---- phase:end ----` markers and evaluated in a
// sandbox, so the tests exercise the SHIPPING code instead of a copy that can
// drift. Run with:  node test/phase.test.mjs   (or: npm test)
//
// Rule under test (official pricing docs, 2026):
//   空闲时段价格为高峰时段价格的一半。北京时间周一至周五（不含中国法定节假日）
//   9:00-12:00、14:00-18:00 为高峰时段；其余时段，包括周末及中国法定节假日全天
//   均为空闲时段。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE = join(HERE, '..', 'lib', 'index.js')
const BJ_OFFSET = 8 * 3600 * 1000

function loadPhase() {
  const src = readFileSync(SOURCE, 'utf8')
  const begin = src.indexOf('// ---- phase:begin')
  const end = src.indexOf('// ---- phase:end ----')
  if (begin < 0 || end < 0 || end <= begin) {
    throw new Error('phase markers not found in lib/index.js — keep the // ---- phase:begin / end ---- comments')
  }
  const block = src.slice(src.indexOf('\n', begin) + 1, end)
  const factory = new Function(
    'BJ_OFFSET',
    block + '\nreturn { phaseInfo, bjtDateKey, CN_HOLIDAY_SET, CN_HOLIDAY_YEARS }',
  )
  return factory(BJ_OFFSET)
}

const { phaseInfo, CN_HOLIDAY_SET, CN_HOLIDAY_YEARS } = loadPhase()

/** Beijing wall-clock time → epoch ms. */
const bj = (s) => Date.parse(s + '+08:00')
/** epoch ms → readable Beijing time (for failure output). */
const show = (ms) => new Date(ms + BJ_OFFSET).toISOString().replace('T', ' ').slice(0, 16) + ' BJT'

let failed = 0
let passed = 0

function check(name, ms, want) {
  const got = phaseInfo(ms)
  const problems = []
  if (want.mode && got.mode !== want.mode) problems.push(`mode=${got.mode} (want ${want.mode})`)
  if (want.holiday !== undefined && got.holiday !== want.holiday) problems.push(`holiday=${got.holiday} (want ${want.holiday})`)
  if (want.holidayData && got.holidayData !== want.holidayData) problems.push(`holidayData=${got.holidayData} (want ${want.holidayData})`)
  if (want.startMs !== undefined && got.startMs !== want.startMs) problems.push(`start=${show(got.startMs)} (want ${show(want.startMs)})`)
  if (want.endMs !== undefined && got.endMs !== want.endMs) problems.push(`end=${show(got.endMs)} (want ${show(want.endMs)})`)
  if (problems.length) {
    failed++
    console.error(`✗ ${name}\n    at ${show(ms)}\n    ${problems.join('\n    ')}`)
  } else {
    passed++
  }
}

// ---------------------------------------------------------------- weekdays
check('周一 10:00 = 高峰', bj('2026-08-24T10:00:00'), { mode: 'peak', holiday: false, holidayData: 'ok' })
check('周一 12:30 = 空闲（午休）', bj('2026-08-24T12:30:00'), { mode: 'valley' })
check('周一 17:00 = 高峰', bj('2026-08-24T17:00:00'), { mode: 'peak' })
check('周一 19:00 = 空闲（夜间）', bj('2026-08-24T19:00:00'), { mode: 'valley' })
check('周一 08:59 = 空闲（上班前）', bj('2026-08-24T08:59:00'), { mode: 'valley' })
check('周五 11:59 = 高峰', bj('2026-08-28T11:59:00'), { mode: 'peak' })

// ---------------------------------------------------------------- weekends
check('周日 14:05 = 空闲', bj('2026-08-23T14:05:00'), { mode: 'valley', holiday: false })
check('周日 09:30 = 空闲', bj('2026-08-23T09:30:00'), { mode: 'valley' })
check('周六 03:00 = 空闲', bj('2026-08-29T03:00:00'), { mode: 'valley' })
// Whole weekend merges into one segment: Fri 18:00 → Mon 09:00.
check('周五 20:00 = 空闲且周末段起点为周五18:00', bj('2026-08-28T20:00:00'), {
  mode: 'valley',
  startMs: bj('2026-08-28T18:00:00'),
  endMs: bj('2026-08-31T09:00:00'),
})

// ---------------------------------------------------- statutory holidays 2026
check('元旦 2026-01-01(周四) 10:00 = 空闲', bj('2026-01-01T10:00:00'), { mode: 'valley', holiday: true })
check('元旦段(12/31 18:00 → 01/05 09:00，含调休的周日)', bj('2026-01-02T10:00:00'), {
  mode: 'valley',
  startMs: bj('2025-12-31T18:00:00'),
  endMs: bj('2026-01-05T09:00:00'),
})
check('春节 2026-02-17(周二) 10:00 = 空闲', bj('2026-02-17T10:00:00'), { mode: 'valley', holiday: true })
check('春节段(02/13 18:00 → 02/24 09:00)', bj('2026-02-20T10:00:00'), {
  mode: 'valley',
  startMs: bj('2026-02-13T18:00:00'),
  endMs: bj('2026-02-24T09:00:00'),
})
check('清明 2026-04-06(周一) 10:00 = 空闲（原本是高峰）', bj('2026-04-06T10:00:00'), { mode: 'valley', holiday: true })
check('清明次日 2026-04-07(周二) 10:00 = 高峰（对照）', bj('2026-04-07T10:00:00'), { mode: 'peak', holiday: false })
check('劳动节 2026-05-04(周一) 14:30 = 空闲', bj('2026-05-04T14:30:00'), { mode: 'valley', holiday: true })
check('端午 2026-06-19(周五) 10:00 = 空闲', bj('2026-06-19T10:00:00'), { mode: 'valley', holiday: true })
check('中秋 2026-09-25(周五) 10:00 = 空闲', bj('2026-09-25T10:00:00'), { mode: 'valley', holiday: true })
check('中秋前一日 2026-09-24(周四) 10:00 = 高峰（对照）', bj('2026-09-24T10:00:00'), { mode: 'peak', holiday: false })
check('中秋+周末段(09/24 18:00 → 09/28 09:00)', bj('2026-09-26T10:00:00'), {
  mode: 'valley',
  startMs: bj('2026-09-24T18:00:00'),
  endMs: bj('2026-09-28T09:00:00'),
})
check('国庆 2026-10-01(周四) 10:00 = 空闲', bj('2026-10-01T10:00:00'), { mode: 'valley', holiday: true })
check('国庆段(09/30 18:00 → 10/08 09:00)', bj('2026-10-03T10:00:00'), {
  mode: 'valley',
  startMs: bj('2026-09-30T18:00:00'),
  endMs: bj('2026-10-08T09:00:00'),
})
check('国庆后 2026-10-08(周四) 10:00 = 高峰（对照）', bj('2026-10-08T10:00:00'), { mode: 'peak', holiday: false })
// Deliberate reading of the official wording: make-up WORKDAYS are still weekends,
// and the rule says weekends are off-peak all day.
check('调休上班的 2026-10-10(周六) 10:00 = 空闲', bj('2026-10-10T10:00:00'), { mode: 'valley', holiday: false })

// ------------------------------------------- unknown year → explicit fallback
check('2027 元旦未收录：2027-01-04(周一) 10:00 = 高峰 + holidayData=missing', bj('2027-01-04T10:00:00'), {
  mode: 'peak',
  holiday: false,
  holidayData: 'missing',
})

// ------------------------------------------------------------ calendar data
if (!CN_HOLIDAY_YEARS.has(2026)) {
  failed++
  console.error('✗ CN_HOLIDAYS 未收录 2026 年')
} else passed++
// 2026: 元旦3 + 春节9 + 清明3 + 劳动节5 + 端午3 + 中秋3 + 国庆7 = 33 天
if (CN_HOLIDAY_SET.size !== 33) {
  failed++
  console.error(`✗ 2026 年放假日期应为 33 天，实际 ${CN_HOLIDAY_SET.size}`)
} else passed++

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
