// Plugin configuration: defaults plus a hand-written validator.
//
// The plugin ships zero dependencies and cannot resolve @deepseek-ai/* packages,
// so there is no Schemastery `Config` export here — activation validates the raw
// config instead (see lib/index.js). An invalid value fails activation loudly
// rather than silently falling back, because a silently ignored setting is worse
// than a refused one.
//
// Dialect note: a profile patch replaces `config` wholesale, it does not deep
// merge. Users therefore only write the fields they care about, and resolveConfig
// starts from DEFAULTS before applying overrides.

import { API_DEFAULTS } from './deepseek.js'

/** Every tunable the plugin honours. */
export const DEFAULTS = {
  /** How often the balance endpoint is polled. */
  pollIntervalMs: 5 * 60 * 1000,
  /** How much balance-snapshot history to retain (and the cap for a custom window). */
  historyDays: 90,
  /** How long a successful monthly usage response is cached. */
  usageTtlMs: 60 * 60 * 1000,
  /** How long a failed monthly usage response is cached (shorter, so it recovers). */
  usageErrorTtlMs: 10 * 60 * 1000,
  /** Per-request timeout for the DeepSeek endpoints. */
  requestTimeoutMs: API_DEFAULTS.requestTimeoutMs,
  /** Hard cap on retained balance snapshots. */
  maxSnapshots: 5000,
  balanceUrl: API_DEFAULTS.balanceUrl,
  usageCostUrl: API_DEFAULTS.usageCostUrl,
  usageAmountUrl: API_DEFAULTS.usageAmountUrl,
}

const INT_RULES = {
  pollIntervalMs: [30_000, 24 * 3600_000],
  historyDays: [1, 400],
  usageTtlMs: [60_000, 24 * 3600_000],
  usageErrorTtlMs: [60_000, 24 * 3600_000],
  requestTimeoutMs: [1000, 120_000],
  maxSnapshots: [100, 100_000],
}

const URL_KEYS = ['balanceUrl', 'usageCostUrl', 'usageAmountUrl']

const isInt = (v) => typeof v === 'number' && Number.isInteger(v)

/**
 * Merge raw config over DEFAULTS and validate the result.
 * @param raw - the config object from the profile patch (may be undefined).
 * @throws Error naming the offending field and the accepted range.
 */
export function resolveConfig(raw) {
  const provided = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const config = { ...DEFAULTS, ...provided }

  const unknown = Object.keys(provided).filter((k) => !(k in DEFAULTS))
  if (unknown.length) {
    throw new Error(`config: 未知字段 ${unknown.join(', ')}（可用字段：${Object.keys(DEFAULTS).join(', ')}）`)
  }
  for (const [key, [min, max]] of Object.entries(INT_RULES)) {
    if (!isInt(config[key])) throw new Error(`config: ${key} 必须是整数`)
    if (config[key] < min || config[key] > max) {
      throw new Error(`config: ${key} 需要在 ${min} ~ ${max} 之间`)
    }
  }
  for (const key of URL_KEYS) {
    const value = config[key]
    if (typeof value !== 'string' || !/^https:\/\/[^\s]+$/.test(value)) {
      throw new Error(`config: ${key} 必须是 https URL`)
    }
  }
  return config
}

/** Options object for lib/deepseek.js, sliced out of a resolved config. */
export function apiOptions(config) {
  return {
    balanceUrl: config.balanceUrl,
    usageCostUrl: config.usageCostUrl,
    usageAmountUrl: config.usageAmountUrl,
    requestTimeoutMs: config.requestTimeoutMs,
  }
}
