// Peak/valley price-phase algorithm (梁文峰 / 梁文谷).
//
// Moved out of lib/index.js unchanged: this module owns the pricing rule and the
// statutory-holiday calendar, lib/index.js only assembles it. Behaviour is pinned
// by test/phase.test.mjs (28 cases: weekdays, weekends, holidays, merged runs,
// unlisted years), which imports this file directly.
//
// Source of the rule: api-docs.deepseek.com/zh-cn/quick_start/pricing — during the
// peak window the price is 2x the off-peak price.

/** Beijing is UTC+8 with no DST, so a fixed offset is exact. */
export const BJ_OFFSET = 8 * 3600 * 1000

// Official pricing rule (2026, api-docs.deepseek.com/zh-cn/quick_start/pricing):
//   "空闲时段价格为高峰时段价格的一半。北京时间周一至周五（不含中国法定
//    节假日）9:00-12:00、14:00-18:00 为高峰时段；其余时段，包括周末及中国
//    法定节假日全天均为空闲时段。"
//
// ⚠️ 维护：每年 11-12 月国务院办公厅公布次年安排后，必须把次年"放假"日期补进
//    CN_HOLIDAYS，否则次年元旦/春节起会把节假日误判为高峰时段。
//    通知检索词：「国务院办公厅关于<年份>年部分节假日安排的通知」。
//    只收"放假"日期；调休上班日都落在周末，按官方口径仍属"周末→空闲"，
//    因此无需列出（2026 年调休上班日：01-04、02-14、02-28、05-09、09-20、10-10）。
export const CN_HOLIDAYS = {
  2026: [
    '2026-01-01', '2026-01-02', '2026-01-03', // 元旦（1/1-1/3）
    '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19',
    '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23', // 春节（2/15-2/23）
    '2026-04-04', '2026-04-05', '2026-04-06', // 清明（4/4-4/6）
    '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', // 劳动节（5/1-5/5）
    '2026-06-19', '2026-06-20', '2026-06-21', // 端午（6/19-6/21）
    '2026-09-25', '2026-09-26', '2026-09-27', // 中秋（9/25-9/27）
    '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    '2026-10-05', '2026-10-06', '2026-10-07', // 国庆（10/1-10/7）
  ],
}
export const CN_HOLIDAY_SET = new Set()
export const CN_HOLIDAY_YEARS = new Set()
for (const y of Object.keys(CN_HOLIDAYS)) {
  CN_HOLIDAY_YEARS.add(Number(y))
  for (const d of CN_HOLIDAYS[y]) CN_HOLIDAY_SET.add(d)
}
/** Beijing calendar date key (YYYY-MM-DD) from a BJT-shifted timestamp. */
export function bjtDateKey(shiftedMs) {
  const d = new Date(shiftedMs)
  const p = (n) => (n < 10 ? '0' + n : String(n))
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate())
}

export function phaseInfo(nowMs) {
  const shifted = nowMs + BJ_OFFSET
  const dayStartShifted = Math.floor(shifted / 86400000) * 86400000
  const dayStartMs = dayStartShifted - BJ_OFFSET
  const B = [0, 540, 720, 840, 1080, 1440] // Beijing 0:00 9:00 12:00 14:00 18:00 24:00
  // Peak = Beijing Mon–Fri 09:00–12:00 & 14:00–18:00, excluding Chinese statutory
  // holidays; weekends and holidays are off-peak all day (price = 50% of peak).
  // Segments are merged across same-mode boundaries, so the weekend is one
  // continuous 梁文谷 segment from Friday 18:00 to Monday 09:00, and a holiday
  // that touches a weekend merges with it.
  const events = []
  // The window must contain the WHOLE current segment, otherwise a long holiday
  // run (Spring Festival = 9 days, plus adjacent weekends) gets clipped and the
  // reported start/end are wrong. ±14 days covers the longest possible run
  // (~11 days) with margin; the event list stays trivial (~174 entries).
  for (let dayOff = -14; dayOff <= 14; dayOff++) {
    const dayS = dayStartMs + dayOff * 86400000
    // UTC fields of the shifted date equal Beijing fields.
    const dayShifted = dayStartShifted + dayOff * 86400000
    const wd = new Date(dayShifted).getUTCDay()
    const weekend = wd === 0 || wd === 6
    const holiday = CN_HOLIDAY_SET.has(bjtDateKey(dayShifted))
    for (let i = 0; i < 6; i++) {
      const kind = weekend || holiday || (i !== 1 && i !== 3) ? 'valley' : 'peak'
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
  const holidayToday = CN_HOLIDAY_SET.has(bjtDateKey(shifted))
  const wdToday = new Date(shifted).getUTCDay()
  const weekendToday = wdToday === 0 || wdToday === 6
  const year = new Date(shifted).getUTCFullYear()
  const holidayData = CN_HOLIDAY_YEARS.has(year) ? 'ok' : 'missing'
  let note
  if (peak) note = '高峰时段（北京时间周一至周五 09:00-12:00、14:00-18:00，法定节假日除外）：价格是空闲时段的 2 倍，请减少 API 调用！'
  else if (holidayToday) note = '法定节假日全天为空闲时段：价格为高峰的 50%（半价），适合集中调用。'
  else if (weekendToday) note = '周末全天为空闲时段：价格为高峰的 50%（半价），适合集中调用。'
  else note = '空闲时段（工作日 09:00 前、12:00-14:00、18:00 后）：价格为高峰的 50%（半价），适合集中调用。'
  if (holidayData === 'missing') note += `（${year} 年法定节假日数据未收录，暂按普通周一至周五判定，请更新插件）`
  return {
    mode: seg.kind,
    label: peak ? '梁文峰' : '梁文谷',
    startMs: seg.t,
    endMs: seg.end,
    note,
    holiday: holidayToday,
    holidayData,
    holidayYears: [...CN_HOLIDAY_YEARS].sort((a, b) => a - b),
    // Structured facts the client needs to phrase the same note in its own
    // language. `note` above stays as the host-side (Chinese) fallback, so a
    // client that predates these fields keeps working.
    weekend: weekendToday,
    year,
  }
}
