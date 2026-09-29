// The read-only agent tool.
//
// Why it is hand-built instead of using the harness's `defineTool()`: this plugin
// ships zero dependencies and cannot resolve @deepseek-ai/* packages, while
// `defineTool` lives in @deepseek-ai/dsh-tools. The definition below therefore
// carries only what the tool runtime actually reads for a raw registration:
//
//   * `name`, `description`            — model-facing identity,
//   * `parameters`                     — a full JSON Schema object (lossless JSON),
//   * `output.schema` / `output.render`— result validation + transcript content,
//   * `execute(args, exec)`            — the body (the runtime validates nothing
//     for us, so the arguments are checked here).
//
// Every failure mode is contained by lib/index.js: the registration runs inside a
// try/catch, so an unexpected contract change degrades to "no tool" instead of a
// plugin that will not activate.
//
// Read-only by construction: the tool can only call `service.getState({ window })`,
// which projects a window without persisting it. Credential writing (`setConfig`)
// is not reachable from here at all.

/** Model-facing tool name (also the value asserted in the tests). */
export const TOOL_NAME = 'deepseek_balance'

/** Windows the tool accepts; mirrors lib/validate.js WINDOW_IDS. */
const TOOL_WINDOWS = ['today', '24h', '7d', 'custom']

/** Argument schema handed to the model. */
const PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    window: {
      type: 'string',
      enum: TOOL_WINDOWS,
      description: 'Which period to report spend for. Defaults to the window selected in the widget.',
    },
    fromMs: {
      type: 'integer',
      description: 'Epoch milliseconds marking the start of a custom window (only used with window="custom").',
    },
  },
}

/**
 * Result schema. Deliberately free of nullable unions (`oneOf`/`anyOf`): unknown
 * values are reported as `known: false` / empty strings instead, which keeps the
 * schema inside the subset the runtime accepts everywhere.
 */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['nowMs', 'phase', 'window', 'balance', 'tokens', 'configured', 'lastPollAtMs', 'lastError'],
  properties: {
    nowMs: { type: 'integer' },
    phase: {
      type: 'object',
      additionalProperties: false,
      required: ['mode', 'label', 'startMs', 'endMs', 'holiday', 'holidayData'],
      properties: {
        mode: { type: 'string', enum: ['peak', 'valley'] },
        label: { type: 'string' },
        startMs: { type: 'integer' },
        endMs: { type: 'integer' },
        holiday: { type: 'boolean' },
        holidayData: { type: 'string', enum: ['ok', 'missing'] },
      },
    },
    window: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'fromMs', 'toMs', 'spent', 'spentKnown', 'source', 'partial', 'usageError', 'tokenError'],
      properties: {
        id: { type: 'string', enum: TOOL_WINDOWS },
        fromMs: { type: 'integer' },
        toMs: { type: 'integer' },
        spent: { type: 'number' },
        spentKnown: { type: 'boolean' },
        source: { type: 'string', enum: ['official', 'estimate', 'none'] },
        partial: { type: 'boolean' },
        usageError: { type: 'string' },
        tokenError: { type: 'string' },
      },
    },
    balance: {
      type: 'object',
      additionalProperties: false,
      required: ['known', 'currency', 'total', 'toppedUp', 'available'],
      properties: {
        known: { type: 'boolean' },
        currency: { type: 'string' },
        total: { type: 'number' },
        toppedUp: { type: 'number' },
        available: { type: 'boolean' },
      },
    },
    tokens: {
      type: 'object',
      additionalProperties: false,
      required: ['known', 'hit', 'miss', 'out', 'total'],
      properties: {
        known: { type: 'boolean' },
        hit: { type: 'number' },
        miss: { type: 'number' },
        out: { type: 'number' },
        total: { type: 'number' },
      },
    },
    configured: {
      type: 'object',
      additionalProperties: false,
      required: ['apiKey', 'platformToken'],
      properties: {
        apiKey: { type: 'boolean' },
        platformToken: { type: 'boolean' },
      },
    },
    lastPollAtMs: { type: 'integer' },
    lastError: { type: 'string' },
  },
}

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

/**
 * Flatten one state payload into the tool's result shape.
 * Pure, so the mapping is unit-tested without a service.
 */
export function toToolResult(state) {
  const bal = state && state.balance
  const win = (state && state.window) || {}
  const tok = win.tokens
  const phase = (state && state.phase) || {}
  return {
    nowMs: num(state && state.nowMs),
    phase: {
      mode: phase.mode === 'peak' ? 'peak' : 'valley',
      label: typeof phase.label === 'string' ? phase.label : '',
      startMs: num(phase.startMs),
      endMs: num(phase.endMs),
      holiday: phase.holiday === true,
      holidayData: phase.holidayData === 'missing' ? 'missing' : 'ok',
    },
    window: {
      id: TOOL_WINDOWS.includes(win.id) ? win.id : 'today',
      fromMs: num(win.fromMs),
      toMs: num(win.toMs),
      spent: num(win.spent),
      spentKnown: win.spent != null,
      source: win.source === 'official' || win.source === 'estimate' ? win.source : 'none',
      partial: win.partial === true,
      usageError: typeof win.usageError === 'string' ? win.usageError : '',
      tokenError: typeof win.tokenError === 'string' ? win.tokenError : '',
    },
    balance: {
      known: !!bal,
      currency: bal && typeof bal.currency === 'string' ? bal.currency : 'CNY',
      total: num(bal && bal.total),
      toppedUp: num(bal && bal.toppedUp),
      available: !!(bal && bal.available),
    },
    tokens: {
      known: !!tok,
      hit: num(tok && tok.hit),
      miss: num(tok && tok.miss),
      out: num(tok && tok.out),
      total: num(tok && tok.total),
    },
    configured: {
      apiKey: !!(state && state.configured && state.configured.apiKey),
      platformToken: !!(state && state.configured && state.configured.platformToken),
    },
    lastPollAtMs: num(state && state.lastPollAtMs),
    lastError: typeof (state && state.lastError) === 'string' ? state.lastError : '',
  }
}

/** Beijing wall-clock label for a timestamp (the pricing rule is in Beijing time). */
function bjt(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 'unknown'
  return new Date(ms + 8 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' BJT'
}

/** Build the transcript text. English on purpose: tool output is model-facing. */
export function renderText(value) {
  const lines = []
  const peak = value.phase.mode === 'peak'
  lines.push(`DeepSeek price phase: ${peak ? 'PEAK (梁文峰, 2x price)' : 'OFF-PEAK (梁文谷, 50% price)'}` +
    `${value.phase.holiday ? ' — statutory holiday' : ''}` +
    `${value.phase.holidayData === 'missing' ? ` (holiday data for ${new Date(value.nowMs + 8 * 3600 * 1000).getUTCFullYear()} not bundled)` : ''}`)
  lines.push(`  window: ${bjt(value.phase.startMs)} -> ${bjt(value.phase.endMs)}`)
  if (value.balance.known) {
    lines.push(`Balance: ${value.balance.total.toFixed(2)} ${value.balance.currency} total, ${value.balance.toppedUp.toFixed(2)} topped up`)
  } else {
    lines.push('Balance: not available (no API key configured, or the last poll failed)')
  }
  const spend = value.window.spentKnown ? `${value.window.spent.toFixed(2)} ${value.balance.currency}` : 'unknown'
  lines.push(`Spend (${value.window.id}): ${spend}` +
    `${value.window.spentKnown && value.window.source === 'estimate' ? ' (estimated from balance snapshots)' : ''}` +
    `${value.window.partial ? ' — partial, likely low' : ''}`)
  if (value.tokens.known) {
    lines.push(`Tokens (${value.window.id}): ${value.tokens.hit} cache-hit / ${value.tokens.miss} cache-miss / ${value.tokens.out} output`)
  } else if (value.configured.platformToken) {
    lines.push('Tokens: unavailable — the platform usage endpoint failed')
  } else {
    lines.push('Tokens: not configured (needs a platform userToken)')
  }
  if (value.lastError) lines.push(`Last error: ${value.lastError}`)
  return lines.join('\n')
}

/**
 * Build the tool definition.
 * @param options.service - lib/service.js instance (only getState is used).
 * @param options.maxAgeMs - oldest accepted `fromMs`, mirroring the request validator.
 */
export function createBalanceTool({ service, maxAgeMs = 90 * 86400000 }) {
  return {
    name: TOOL_NAME,
    description:
      'Read the DeepSeek account balance, the spend and token usage of a period, and the current ' +
      'peak/off-peak price phase (Beijing time; peak costs twice the off-peak price). Read-only: it ' +
      'never changes settings or credentials. Use it before advising the user about cost.',
    parameters: PARAMETERS,
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: renderText(value) }],
    },
    async execute(args) {
      const input = args && typeof args === 'object' ? args : {}
      const window = input.window
      if (window !== undefined && !TOOL_WINDOWS.includes(window)) {
        throw new Error(`window must be one of ${TOOL_WINDOWS.join(', ')}`)
      }
      const fromMs = input.fromMs
      const now = Date.now()
      if (fromMs !== undefined && !Number.isFinite(fromMs)) {
        throw new Error('fromMs must be epoch milliseconds (a number)')
      }
      if (fromMs !== undefined && fromMs > now) {
        throw new Error('fromMs cannot be in the future')
      }
      if (fromMs !== undefined && fromMs < now - maxAgeMs) {
        throw new Error(`fromMs cannot be older than ${Math.round(maxAgeMs / 86400000)} days`)
      }
      // Projection only: getState({ window }) never writes settings or the file.
      const state = await service.getState(window ? { window, fromMs } : undefined)
      return toToolResult(state)
    },
  }
}
