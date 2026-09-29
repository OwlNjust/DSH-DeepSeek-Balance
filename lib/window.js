// Window aggregation for the balance widget.
//
// Pure functions extracted from lib/index.js: turning the user's window setting
// into a [fromMs, toMs] range, estimating spend from balance snapshots, and
// summing the platform's monthly usage payloads over that range. The HTTP/cache
// part stays in lib/index.js (and later the Host service), so everything here is
// directly unit-testable.

/** Beijing-time calendar day key used by the platform's daily usage payloads. */
function bjtDateKey(shiftedMs) {
  const d = new Date(shiftedMs)
  const p = (n) => (n < 10 ? '0' + n : String(n))
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate())
}

/**
 * Resolve the selected window into a concrete range.
 * @param settings - state-file settings (`window`, `customFromMs`).
 * @param nowMs - current time.
 * @param bjOffsetMs - Beijing offset, injectable for tests.
 */
export function windowOf(settings, nowMs, bjOffsetMs) {
  const id = settings && settings.window
  if (id === 'custom') {
    const fromMs = settings && typeof settings.customFromMs === 'number' ? settings.customFromMs : null
    return { id: 'custom', fromMs, toMs: nowMs }
  }
  if (id === '24h') return { id: '24h', fromMs: nowMs - 86400000, toMs: nowMs }
  if (id === '7d') return { id: '7d', fromMs: nowMs - 7 * 86400000, toMs: nowMs }
  const shifted = nowMs + bjOffsetMs
  const dayStartMs = Math.floor(shifted / 86400000) * 86400000 - bjOffsetMs
  return { id: 'today', fromMs: dayStartMs, toMs: nowMs }
}

/**
 * Estimate spend as the drop between consecutive balance snapshots.
 * `partial` marks a window that began before the first snapshot, i.e. the number
 * can only be a lower bound.
 * @returns null when there is nothing to estimate from.
 */
export function spentFromSnapshots(snapshots, fromMs, toMs) {
  const snaps = Array.isArray(snapshots) ? snapshots : []
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
    // Only a decrease is spend; a rise means a top-up, which is not consumption.
    if (ta != null && tb != null && tb < ta) spent += ta - tb
  }
  return { spent, partial: baseIdx < 0 }
}

/**
 * Break a range into the Beijing calendar months it touches.
 * @returns `{ fromDate, toDate, months: [{ year, month }] }` — `month` is 1-12.
 */
export function monthRange(fromMs, toMs, bjOffsetMs) {
  const start = new Date(fromMs + bjOffsetMs)
  const end = new Date(toMs + bjOffsetMs)
  const months = []
  let year = start.getUTCFullYear()
  let month = start.getUTCMonth() + 1
  const endYear = end.getUTCFullYear()
  const endMonth = end.getUTCMonth() + 1
  let guard = 0
  // The request validator caps the range at 90 days, so this guard is only a
  // belt-and-braces stop for a malformed range.
  while ((year < endYear || (year === endYear && month <= endMonth)) && guard < 24) {
    guard++
    months.push({ year, month })
    month++
    if (month > 12) {
      month = 1
      year++
    }
  }
  return {
    fromDate: bjtDateKey(fromMs + bjOffsetMs),
    toDate: bjtDateKey(toMs + bjOffsetMs),
    months,
  }
}

/**
 * Sum per-month usage payloads over the requested dates.
 * @param entries - `[{ costDays, amountDays, amountError }]`, one per month.
 * @param range - the result of monthRange() (only fromDate/toDate are read).
 * @returns `{ total, models, tokens, tokenError }`; `tokens` is null when the
 *          amount endpoint failed, in which case `tokenError` says why.
 */
export function sumMonths(entries, range) {
  const { fromDate, toDate } = range
  let total = 0
  const modelTotals = {}
  let hit = 0
  let miss = 0
  let out = 0
  let amountError = null
  for (const entry of entries) {
    if (!entry) continue
    for (const day of entry.costDays || []) {
      if (day.date >= fromDate && day.date <= toDate) {
        total += day.cost
        if (day.models) {
          for (const name in day.models) modelTotals[name] = (modelTotals[name] || 0) + day.models[name]
        }
      }
    }
    if (entry.amountError) amountError = entry.amountError
    else {
      for (const day of entry.amountDays || []) {
        if (day.date >= fromDate && day.date <= toDate) {
          hit += day.hit
          miss += day.miss
          out += day.out
        }
      }
    }
  }
  const models = []
  for (const name in modelTotals) models.push({ model: name, cost: modelTotals[name] })
  models.sort((a, b) => b.cost - a.cost)
  return {
    total,
    models,
    tokens: amountError ? null : { hit, miss, out, total: hit + miss + out },
    tokenError: amountError,
  }
}
