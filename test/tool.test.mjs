// Unit tests for lib/tool.js — the read-only agent tool.
//
// Two things matter here and are both checkable without the harness: the
// definition must be shaped the way a raw registration is consumed (lossless-JSON
// JSON-Schema parameters, an output schema its own value satisfies, an
// `execute(args)` body), and it must stay **read-only** — projecting a window
// needs no store write and no settings change.
// Run: node test/tool.test.mjs

import { TOOL_NAME, createBalanceTool, renderText, toToolResult } from '../lib/tool.js'

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
const throws = async (fn, needle) => {
  let threw = null
  try {
    await fn()
  } catch (error) {
    threw = error
  }
  assert(threw !== null, 'expected a throw, but the call succeeded')
  if (needle) assert(String(threw.message).includes(needle), `message "${threw.message}" does not include "${needle}"`)
}

// ---------------------------------------------- a minimal JSON-Schema checker
// The harness validates output.schema with its own validator; this dependency-free
// subset check (types + required + additionalProperties + enum) keeps CI honest
// about the schema/value pair without importing the harness.
function validate(schema, value, path = 'value') {
  if (schema.type === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return [`${path}: not an object`]
    const problems = []
    for (const key of schema.required || []) {
      if (!(key in value)) problems.push(`${path}.${key}: missing`)
    }
    for (const [key, sub] of Object.entries(value)) {
      const prop = (schema.properties || {})[key]
      if (!prop) {
        if (schema.additionalProperties === false) problems.push(`${path}.${key}: not allowed`)
        continue
      }
      problems.push(...validate(prop, sub, `${path}.${key}`))
    }
    return problems
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return [`${path}: not an array`]
    return value.flatMap((item, index) => validate(schema.items || {}, item, `${path}[${index}]`))
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') return [`${path}: not a string`]
    return schema.enum && !schema.enum.includes(value) ? [`${path}: ${JSON.stringify(value)} not in enum`] : []
  }
  if (schema.type === 'number') return typeof value === 'number' && Number.isFinite(value) ? [] : [`${path}: not a number`]
  if (schema.type === 'integer') return Number.isInteger(value) ? [] : [`${path}: not an integer`]
  if (schema.type === 'boolean') return typeof value === 'boolean' ? [] : [`${path}: not a boolean`]
  return []
}
const lossless = (value) => JSON.stringify(JSON.parse(JSON.stringify(value))) === JSON.stringify(value)

// -------------------------------------------------------------- fixture state
const sampleState = {
  nowMs: Date.parse('2026-09-29T06:00:00Z'),
  configured: { apiKey: true, platformToken: true },
  keyMask: 'sk-****cdef',
  balance: { currency: 'CNY', total: 12.5, toppedUp: 10, granted: 2.5, available: true, fetchedAtMs: 1 },
  phase: { mode: 'valley', label: '梁文谷', startMs: 1, endMs: 2, note: '内部中文提示', holiday: false, holidayData: 'ok', holidayYears: [2026], weekend: false, year: 2026 },
  window: { id: '24h', fromMs: 1, toMs: 2, spent: 3.25, source: 'official', partial: false, usageError: null, models: [{ model: 'm', cost: 3.25 }], tokens: { hit: 10, miss: 20, out: 5, total: 35 }, tokenError: null },
  historyCount: 2,
  lastPollAtMs: 5,
  lastError: null,
  pollIntervalMs: 300000,
  locale: 'zh',
  storageError: null,
}

/** A service stub that records how it was called and never writes anything. */
function fakeService(state = sampleState) {
  const calls = []
  const writes = []
  return {
    calls,
    writes,
    async getState(options) {
      calls.push(options)
      return { ...state, window: options && options.window ? { ...state.window, id: options.window } : state.window }
    },
    // Present so an accidental write would be observable in the assertions.
    async setWindow(input) { writes.push(['setWindow', input]); return state },
    async setConfig(input) { writes.push(['setConfig', input]); return state },
  }
}

// ------------------------------------------------------------------ definition
await ok('tool: 定义形状符合裸注册契约（无损 JSON 参数 + output.schema/render/execute）', () => {
  const tool = createBalanceTool({ service: fakeService() })
  eq(tool.name, TOOL_NAME, 'name')
  assert(tool.name === 'deepseek_balance', `工具名应稳定，实际 ${tool.name}`)
  assert(typeof tool.description === 'string' && tool.description.length > 40, 'description 应给模型足够信息')
  assert(lossless(tool.parameters), 'parameters 必须是无损 JSON')
  assert(tool.parameters.type === 'object', 'parameters 应是完整 JSON Schema（type: object）')
  eq(tool.parameters.additionalProperties, false, 'parameters.additionalProperties')
  eq(Object.keys(tool.parameters.properties).sort().join(','), 'fromMs,window', '参数集合')
  assert(lossless(tool.output.schema), 'output.schema 必须是无损 JSON')
  eq(tool.output.schema.type, 'object', 'output.schema.type')
  assert(typeof tool.output.render === 'function', 'output.render 必需')
  assert(typeof tool.execute === 'function', 'execute 必需')
  assert(tool.execute.length >= 1, 'execute 应接收 args')
})
await ok('tool: 参数与结果都没有可空联合（oneOf/anyOf 一律不用）', () => {
  const tool = createBalanceTool({ service: fakeService() })
  const text = JSON.stringify(tool.parameters) + JSON.stringify(tool.output.schema)
  assert(!/"oneOf"|"anyOf"|"allOf"|"not"/.test(text), '避免依赖验证器不一定支持的组合子')
  assert(!/"null"/.test(text), '避免 nullable 类型（用 known/空串表示未知）')
})

// --------------------------------------------------------------------- execute
await ok('tool: execute 返回的结果满足自己的 output.schema', async () => {
  const tool = createBalanceTool({ service: fakeService() })
  const value = await tool.execute({})
  const problems = validate(tool.output.schema, value)
  eq(problems.join(' | '), '', 'schema 违规')
  eq(value.window.spent, 3.25, 'spent')
  eq(value.tokens.total, 35, 'tokens.total')
  eq(value.balance.total, 12.5, 'balance.total')
})
await ok('tool: 只读——不落盘、不改设置，且不暴露 key 片段', async () => {
  const service = fakeService()
  const tool = createBalanceTool({ service })
  const value = await tool.execute({ window: '7d' })
  eq(service.writes.length, 0, '不得调用任何写操作')
  eq(service.calls.length, 1, '只应调用一次 getState')
  eq(service.calls[0].window, '7d', 'getState 应收到窗口投影参数')
  eq(value.window.id, '7d', '窗口投影生效')
  assert(!JSON.stringify(value).includes('cdef'), '不得包含 keyMask 片段')
  assert(!JSON.stringify(value).includes('sk-'), '不得包含任何 key 形态字符串')
})
await ok('tool: 未配置时给出 known=false 而不是 null/NaN', async () => {
  const state = { ...sampleState, balance: null, window: { ...sampleState.window, spent: null, source: null, tokens: null }, lastError: '未配置 DeepSeek API Key' }
  const tool = createBalanceTool({ service: fakeService(state) })
  const value = await tool.execute({})
  eq(value.balance.known, false, 'balance.known')
  eq(value.window.spentKnown, false, 'window.spentKnown')
  eq(value.window.source, 'none', 'source')
  eq(value.tokens.known, false, 'tokens.known')
  eq(value.lastError, '未配置 DeepSeek API Key', 'lastError 应透传')
  eq(validate(tool.output.schema, value).join(' | '), '', 'schema 违规')
})
await ok('tool: 参数校验在 execute 内完成（未知窗口/未来/过旧/类型错）', async () => {
  const tool = createBalanceTool({ service: fakeService(), maxAgeMs: 86400000 })
  await throws(() => tool.execute({ window: 'month' }), 'window must be one of')
  await throws(() => tool.execute({ fromMs: Date.now() + 60000 }), 'future')
  await throws(() => tool.execute({ fromMs: Date.now() - 2 * 86400000 }), 'older than 1 days')
  await throws(() => tool.execute({ fromMs: 'yesterday' }), 'epoch milliseconds')
})
await ok('tool: 空参数/无参调用等价于"用界面当前窗口"', async () => {
  const service = fakeService()
  const tool = createBalanceTool({ service })
  await tool.execute(undefined)
  await tool.execute({})
  eq(service.calls[0], undefined, '无参应传 undefined（用保存的设置）')
  eq(service.calls[1], undefined, '空对象同理')
})

// ---------------------------------------------------------------------- render
await ok('tool: 渲染文本为英文、含关键数字与时段结论', async () => {
  const tool = createBalanceTool({ service: fakeService() })
  const value = await tool.execute({})
  const parts = tool.output.render({}, value)
  assert(Array.isArray(parts) && parts.length === 1 && parts[0].type === 'text', 'render 应返回 [{type:"text"}]')
  const text = parts[0].text
  assert(text.includes('OFF-PEAK'), '应说明当前时段')
  assert(text.includes('12.50'), '应含余额')
  assert(text.includes('3.25'), '应含消耗')
  assert(text.includes('10 cache-hit'), '应含 Token')
  assert(!/[\u4e00-\u9fff]/.test(text.replace(/梁文[峰谷]/g, '')), '模型面向文本除专有名词外应为英文')
})
await ok('tool: renderText 对缺失数据不产生 NaN/undefined', () => {
  const value = toToolResult({ nowMs: 1, phase: { mode: 'peak' }, window: {}, balance: null, tokens: null, configured: {} })
  const text = renderText(value)
  assert(!/NaN|undefined/.test(text), `渲染不应出现 NaN/undefined：${text}`)
  assert(text.includes('not available'), '应说明余额不可用')
  assert(text.includes('not configured'), '应说明 Token 未配置')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
