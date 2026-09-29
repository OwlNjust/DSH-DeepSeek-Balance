// Unit tests for lib/service.js — the operations behind the routes, exercised
// with an injected HTTP layer so no network (and no real credentials) is needed.
// Run: node test/service.test.mjs

import { resolveConfig } from '../lib/config.js'
import { createService, normalizeState } from '../lib/service.js'
import { emptyState } from '../lib/store.js'

const config = resolveConfig({})

let failed = 0
let passed = 0

async function ok(name, fn) {
  try {
    await fn()
    passed++
  } catch (error) {
    failed++
    console.error(`✗ ${name}\n    ${error.message}`)
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg)
}
const eq = (got, want, what) => assert(got === want, `${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)

/** A store stub that records what was saved. */
function fakeStore(loadError = null) {
  const saves = []
  return {
    saves,
    loadError,
    saveError: null,
    save(state) {
      saves.push(JSON.parse(JSON.stringify(state)))
      return Promise.resolve()
    },
  }
}
const makeService = (overrides = {}) => {
  const store = fakeStore(overrides.loadError || null)
  const service = createService({
    config,
    api: {},
    stateStore: store,
    initial: normalizeState({ ...emptyState(), ...(overrides.state || {}) }, config),
    locale: overrides.locale === undefined ? null : overrides.locale,
    http: overrides.http || {},
  })
  return { service, store }
}

// ----------------------------------------------------------------- normalize
await ok('service: normalizeState 修正窗口/快照/凭据形状，并保留未知字段', async () => {
  const doc = normalizeState({
    apiKey: '  sk-abc  ',
    snapshots: [{ t: Date.now(), total: 1 }, { t: 'nope' }, { total: 2 }],
    settings: { window: 'bogus', customFromMs: 'x' },
    futureField: 7,
    schemaVersion: 0,
  }, config)
  eq(doc.apiKey, 'sk-abc', 'apiKey 应 trim')
  eq(doc.snapshots.length, 1, '非法快照应被丢弃')
  eq(doc.settings.window, 'today', '非法窗口应回退 today')
  eq(doc.settings.customFromMs, null, '非法 customFromMs 应为 null')
  eq(doc.futureField, 7, '未知字段应保留（向前兼容）')
  eq(doc.schemaVersion, 1, '应写入当前 schemaVersion')
})
await ok('service: normalizeState 按 historyDays 裁掉过期快照', async () => {
  const old = Date.now() - (config.historyDays + 1) * 86400000
  const doc = normalizeState({ snapshots: [{ t: old, total: 1 }, { t: Date.now(), total: 2 }] }, config)
  eq(doc.snapshots.length, 1, '过期快照应被裁掉')
})

// ---------------------------------------------------------------------- poll
await ok('service: 未配置 API Key 时 poll 不发请求，只记提示', async () => {
  let calls = 0
  const { service } = makeService({ http: { fetchBalance: async () => { calls++; return {} } } })
  await service.poll()
  eq(calls, 0, '不应调用余额接口')
  const state = await service.getState()
  assert(String(state.lastError).includes('未配置'), `lastError = ${state.lastError}`)
  eq(state.keyMask, null, 'keyMask 应为 null')
})
await ok('service: poll 成功后写快照、清 lastError，keyMask 只暴露末 4 位', async () => {
  const { service, store } = makeService({
    state: { apiKey: 'sk-0123456789abcdef' },
    http: { fetchBalance: async () => ({ currency: 'CNY', total: 12.5, toppedUp: 10, granted: 2.5, available: true }) },
  })
  await service.poll()
  const state = await service.getState()
  eq(state.balance.total, 12.5, 'balance.total')
  eq(state.lastError, null, 'lastError 应清空')
  eq(state.keyMask, 'sk-****cdef', 'keyMask 只应含末 4 位')
  assert(!JSON.stringify(state).includes('sk-0123456789abcdef'), '状态载荷绝不能包含完整 key')
  eq(state.historyCount, 1, '应记录一个快照')
  assert(store.saves.length >= 1, 'poll 后应落盘')
})
await ok('service: 余额接口失败 → lastError 记原因，不抛错', async () => {
  const { service } = makeService({
    state: { apiKey: 'sk-x' },
    http: { fetchBalance: async () => { throw new Error('令牌失效') } },
  })
  await service.poll()
  eq((await service.getState()).lastError, '令牌失效', 'lastError')
})
await ok('service: 余额未变且间隔 < 1h 时不新增快照', async () => {
  const { service } = makeService({
    state: { apiKey: 'sk-x', snapshots: [{ t: Date.now() - 60000, total: 5 }] },
    http: { fetchBalance: async () => ({ currency: 'CNY', total: 5, toppedUp: 5, granted: 0, available: true }) },
  })
  await service.poll()
  eq((await service.getState()).historyCount, 1, '不应重复记录')
})

// --------------------------------------------------------------------- config
await ok('service: setConfig 保存并回传状态；非法 key 形状被拒', async () => {
  const { service } = makeService({})
  const saved = await service.setConfig({ apiKey: 'sk-abcdefgh1234', platformToken: null, clear: false, ignored: [] })
  eq(saved.keyMask, 'sk-****1234', 'keyMask')
  eq(saved.configured.apiKey, true, 'configured.apiKey')
  let threw = null
  try {
    await service.setConfig({ apiKey: 'x'.repeat(64), platformToken: null, clear: false, ignored: [] })
  } catch (error) {
    threw = error
  }
  assert(threw && String(threw.message).includes('sk-'), 'userToken 粘进 key 字段应报错')
})
await ok('service: setConfig 透传 ignoredFields，clear 清空凭据', async () => {
  const { service } = makeService({ state: { apiKey: 'sk-abcdefgh1234' } })
  const withIgnored = await service.setConfig({ apiKey: null, platformToken: null, clear: false, ignored: ['junk'] })
  assert(Array.isArray(withIgnored.ignoredFields) && withIgnored.ignoredFields[0] === 'junk', 'ignoredFields 应回传')
  const cleared = await service.setConfig({ apiKey: null, platformToken: null, clear: true, ignored: [] })
  eq(cleared.configured.apiKey, false, 'clear 后应未配置')
  eq(cleared.keyMask, null, 'clear 后 keyMask 为 null')
})

// --------------------------------------------------------------------- window
await ok('service: setWindow 切换窗口并持久化', async () => {
  const { service, store } = makeService({})
  const state = await service.setWindow({ id: '24h', fromMs: null })
  eq(state.window.id, '24h', 'window.id')
  eq(service.state.settings.window, '24h', '内存设置')
  assert(store.saves.some((s) => s.settings.window === '24h'), '应落盘')
})
await ok('service: custom 带 fromMs 时记录，切走后清空', async () => {
  const { service } = makeService({})
  await service.setWindow({ id: 'custom', fromMs: 12345 })
  eq(service.state.settings.customFromMs, 12345, '应记录 customFromMs')
  await service.setWindow({ id: '7d', fromMs: null })
  eq(service.state.settings.customFromMs, null, '切走应清空')
})

// ------------------------------------------------------- window + usage path
await ok('service: 有 platformToken 时用官方用量接口聚合（可注入、无网络）', async () => {
  let months = 0
  const { service } = makeService({
    state: { apiKey: 'sk-x', platformToken: 'tok', settings: { window: '24h', customFromMs: null } },
    http: {
      fetchBalance: async () => ({ currency: 'CNY', total: 1, toppedUp: 1, granted: 0, available: true }),
      fetchMonthData: async () => {
        months++
        return {
          costDays: [{ date: new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10), cost: 3, models: { m1: 3 } }],
          amountDays: [{ date: new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10), hit: 1, miss: 2, out: 3 }],
          amountError: null,
        }
      },
    },
  })
  const state = await service.getState()
  eq(state.window.source, 'official', 'source')
  eq(state.window.spent, 3, 'spent')
  eq(state.window.tokens.total, 6, 'tokens')
  eq(state.window.models[0].model, 'm1', 'models')
  assert(months >= 1, '应请求过用量接口')
})
await ok('service: 用量接口失败 → 回退快照估算并带 usageError', async () => {
  const dayStart = Math.floor((Date.now() + 8 * 3600 * 1000) / 86400000) * 86400000 - 8 * 3600 * 1000
  const { service } = makeService({
    state: {
      apiKey: 'sk-x',
      platformToken: 'tok',
      settings: { window: 'today', customFromMs: null },
      snapshots: [
        { t: dayStart + 1000, total: 10 },
        { t: dayStart + 2000, total: 7 },
      ],
    },
    http: {
      fetchBalance: async () => ({ currency: 'CNY', total: 7, toppedUp: 7, granted: 0, available: true }),
      fetchMonthData: async () => { throw new Error('平台接口 401') },
    },
  })
  const state = await service.getState()
  eq(state.window.source, 'estimate', 'source 应回退估算')
  eq(state.window.spent, 3, '估算值')
  assert(String(state.window.usageError).includes('401'), `usageError = ${state.window.usageError}`)
})

// ------------------------------------------------------------ passthrough bits
await ok('service: 状态载荷带 pollIntervalMs / locale / storageError', async () => {
  const { service } = makeService({ locale: 'en', loadError: '状态文件不是合法 JSON' })
  const state = await service.getState()
  eq(state.pollIntervalMs, config.pollIntervalMs, 'pollIntervalMs')
  eq(state.locale, 'en', 'locale')
  eq(state.storageError, '状态文件不是合法 JSON', 'storageError')
  service.setLocale(null)
  eq((await service.getState()).locale, null, 'setLocale(null) 应清空')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
