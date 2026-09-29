// dsh-deepseek-balance — client half.
// Browser module artefact consumed by the dsh web client module system
// (window.__ModuleLoader__). The widget is registered in the shell.overlay
// slot (bottom-right floating card) and talks to the host plugin through
// same-origin /dsbal/* HTTP routes (authenticated by the browser session cookie,
// exactly like the host's own /api surface).
//
// The artefact must stay self-contained and lazy: no ESM import, only the
// `react` baseline from the loader's seed table. All visible text comes from the
// STRINGS table below, so the panel speaks the host's language choice (or the
// browser's) instead of always speaking Chinese.
window.__ModuleLoader__.load({
  id: 'dsh-deepseek-balance',
  factory(require) {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const e = React.createElement

    const CSS = '' +
      '.dsb-widget{position:fixed;right:16px;bottom:16px;z-index:80;font-size:13px;color:var(--dsw-alias-label-primary);pointer-events:auto;}' +
      '.dsb-pill{display:flex;align-items:center;gap:9px;padding:9px 16px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer;user-select:none;-webkit-user-select:none;backdrop-filter:blur(12px);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 92%,transparent);transition:border-color .15s ease, transform .15s ease;}' +
      '.dsb-pill:hover{border-color:var(--dsw-alias-brand-primary);transform:translateY(-1px);}' +
      '.dsb-dot{width:9px;height:9px;border-radius:50%;display:inline-block;flex:none;}' +
      '.dsb-dot-peak{background:var(--dsw-alias-state-error-primary);}' +
      '.dsb-dot-valley{background:var(--dsw-alias-state-success-primary);}' +
      '.dsb-phase-peak{color:var(--dsw-alias-state-error-primary);font-weight:700;}' +
      '.dsb-phase-valley{color:var(--dsw-alias-state-success-primary);font-weight:700;}' +
      '.dsb-muted{color:var(--dsw-alias-label-primary);opacity:.78;}' +
      '.dsb-panel{width:368px;display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:14px;border:1px solid var(--dsw-alias-border-l2);box-shadow:0 14px 40px rgba(0,0,0,.2);background:var(--dsw-alias-bg-layer-1);animation:dsb-in .18s ease;}' +
      '@keyframes dsb-in{from{opacity:.3;transform:translateY(6px)}to{opacity:1;transform:none}}' +
      '.dsb-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}' +
      '.dsb-head{padding-bottom:10px;border-bottom:1px solid var(--dsw-alias-border-l1);}' +
      '.dsb-title{font-weight:700;font-size:14px;color:var(--dsw-alias-label-primary);}' +
      '.dsb-btn{background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 85%,transparent);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer;transition:border-color .12s ease, background .12s ease;}' +
      '.dsb-btn:hover{border-color:var(--dsw-alias-border-l2);}' +
      '.dsb-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}' +
      '.dsb-btn:disabled{opacity:.5;cursor:default;}' +
      '.dsb-banner{border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:5px;border-left:3px solid;}' +
      '.dsb-peak-bg{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);border-color:var(--dsw-alias-state-error-primary);}' +
      '.dsb-valley-bg{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,transparent);border-color:var(--dsw-alias-state-success-primary);}' +
      '.dsb-badge{font-weight:700;font-size:15px;}' +
      '.dsb-peak-bg .dsb-badge{color:var(--dsw-alias-state-error-primary);}' +
      '.dsb-valley-bg .dsb-badge{color:var(--dsw-alias-state-success-primary);}' +
      '.dsb-cd{font-weight:600;}' +
      '.dsb-note{opacity:.9;line-height:1.6;color:var(--dsw-alias-label-primary);}' +
      '.dsb-stats{display:grid;grid-template-columns:0.9fr 1.4fr;gap:10px;}' +
      '.dsb-stat{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:9px 11px;}' +
      '.dsb-stat-l{color:var(--dsw-alias-label-secondary);font-size:12px;}' +
      '.dsb-stat-v{font-size:16px;font-weight:700;color:var(--dsw-alias-label-primary);}' +
      '.dsb-tokrow{display:flex;align-items:center;gap:6px;font-size:12px;line-height:1.45;}' +
      '.dsb-tokrow .dsb-tok-val{margin-left:auto;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;letter-spacing:.3px;}' +
      '.dsb-tok-sq{width:8px;height:8px;border-radius:2px;flex:none;}' +
      '.dsb-chip{background:transparent;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:4px 11px;font-size:12px;cursor:pointer;transition:color .12s ease, border-color .12s ease, background .12s ease;}' +
      '.dsb-chip:hover{color:var(--dsw-alias-label-primary);}' +
      '.dsb-chip:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}' +
      '.dsb-chip-on{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);font-weight:700;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);}' +
      '.dsb-spent{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;}' +
      '.dsb-src{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.6;}' +
      '.dsb-err{color:var(--dsw-alias-state-error-primary);}' +
      '.dsb-warn{color:var(--dsw-alias-state-warn-primary);}' +
      '.dsb-input{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:7px 10px;font-size:12.5px;width:100%;box-sizing:border-box;}' +
      '.dsb-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary);}' +
      '.dsb-field{display:flex;flex-direction:column;gap:4px;width:100%;}' +
      '.dsb-tag{font-size:11px;font-weight:700;border-radius:999px;padding:2px 8px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);color:var(--dsw-alias-brand-primary);}' +
      '.dsb-tag-warn{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 16%,transparent);color:var(--dsw-alias-state-warn-primary);}' +
      ''

    // ------------------------------------------------------------------ copy ---
    // Every user-visible string. `{name}` placeholders are filled by t().
    const STRINGS = {
      zh: {
        'loading': '余额加载中…',
        'pill.configure': '点击配置 API Key',
        'pill.holidayTitle': '法定节假日：全天空闲',
        'pill.hint': '左键点击展开 · 右键按住拖动可移动位置',
        'panel.title': 'DeepSeek 余额',
        'btn.refresh': '刷新',
        'btn.config': '配置',
        'btn.collapse': '收起',
        'btn.minimize': '收起面板',
        'btn.resetPos': '重置位置（右下角）',
        'btn.resetPosTitle': '恢复默认位置（右下角）',
        'btn.save': '保存',
        'btn.saving': '保存中…',
        'btn.clear': '清除',
        'btn.lang': 'EN',
        'btn.langTitle': 'Switch to English',
        'status.unconfigured': '未配置',
        'label.peak': '梁文峰',
        'label.valley': '梁文谷',
        'tag.holiday': '法定节假日',
        'tag.holidayMissing': '节假日数据待更新',
        'range.prefix': '北京 ',
        'countdown.peak': '高价 ×2 · {dur}后切{next}，省着点用！',
        'countdown.valley': '半价 · {dur}后切{next}',
        'note.peak': '高峰时段（北京时间周一至周五 09:00-12:00、14:00-18:00，法定节假日除外）：价格是空闲时段的 2 倍，请减少 API 调用！',
        'note.holiday': '法定节假日全天为空闲时段：价格为高峰的 50%（半价），适合集中调用。',
        'note.weekend': '周末全天为空闲时段：价格为高峰的 50%（半价），适合集中调用。',
        'note.valley': '空闲时段（工作日 09:00 前、12:00-14:00、18:00 后）：价格为高峰的 50%（半价），适合集中调用。',
        'note.missingYear': '（{year} 年法定节假日数据未收录，暂按普通周一至周五判定，请更新插件）',
        'tok.hit': '输入（命中缓存）',
        'tok.miss': '输入（未命中缓存）',
        'tok.out': '输出',
        'tok.empty': '配置 userToken 后显示 Token 明细',
        'stat.total': '总余额',
        'stat.toppedUp': '充值余额',
        'stat.tokensOf': '{window} Token 消耗',
        'win.today': '今日',
        'win.24h': '近24小时',
        'win.7d': '近7天',
        'win.custom': '自定义',
        'chip.today': '今天',
        'chip.24h': '24h',
        'chip.7d': '7天',
        'spent.suffix': '消耗',
        'custom.pick': '← 选择开始日期',
        'custom.note': '（北京时间零点起算）',
        'source.official': '数据来源：官方用量接口 · 账号全部 API Key 合计',
        'source.estimate': '数据来源：余额快照估算',
        'source.estimatePartial': ' · 仅覆盖快照开始之后，可能偏低',
        'source.none': '配置 API Key 或平台令牌后开始统计',
        'source.failed': ' · 官方接口失败：{error}',
        'models.prefix': '按模型：',
        'cfg.apiKeyLabel': 'DeepSeek API Key（platform.deepseek.com → API keys）',
        'cfg.tokenLabel': '平台令牌 userToken（可选，精确统计 Token/消耗）',
        'cfg.tokenHint': 'userToken：登录 platform.deepseek.com 后 F12 → Local Storage 复制 userToken（可直接粘贴 {"value": "…"} 整段，自动提取）。失效自动回退为估算。',
        'err.request': '⚠ 请求失败：{error}',
        'err.unauthorized': '登录已失效：请重新打开 dsh web 打印的带 token 链接后再试',
        'err.storage': '⚠ 本地状态文件：{error}',
        'dur.days': '{d}天{h}小时',
        'dur.hours': '{h}小时{m}分',
        'dur.minutes': '{m}分钟',
        'week': ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
      },
      en: {
        'loading': 'Loading balance…',
        'pill.configure': 'Click to add an API key',
        'pill.holidayTitle': 'Statutory holiday: off-peak all day',
        'pill.hint': 'Left click expands · right-click and drag to move',
        'panel.title': 'DeepSeek balance',
        'btn.refresh': 'Refresh',
        'btn.config': 'Settings',
        'btn.collapse': 'Hide',
        'btn.minimize': 'Collapse panel',
        'btn.resetPos': 'Reset position (bottom-right)',
        'btn.resetPosTitle': 'Restore the default bottom-right position',
        'btn.save': 'Save',
        'btn.saving': 'Saving…',
        'btn.clear': 'Clear',
        'btn.lang': '中',
        'btn.langTitle': '切换到中文',
        'status.unconfigured': 'not configured',
        'label.peak': '梁文峰 (peak)',
        'label.valley': '梁文谷 (off-peak)',
        'tag.holiday': 'statutory holiday',
        'tag.holidayMissing': 'holiday data outdated',
        'range.prefix': 'Beijing ',
        'countdown.peak': 'Price ×2 · switches to {next} in {dur} — go easy!',
        'countdown.valley': 'Half price · switches to {next} in {dur}',
        'note.peak': 'Peak window (Beijing Mon–Fri 09:00-12:00 and 14:00-18:00, statutory holidays excluded): the price is 2× the off-peak price, so avoid calls now.',
        'note.holiday': 'Statutory holiday: off-peak all day, at 50% of the peak price — a good time to run heavy work.',
        'note.weekend': 'Weekend: off-peak all day, at 50% of the peak price — a good time to run heavy work.',
        'note.valley': 'Off-peak window (weekdays before 09:00, 12:00-14:00 and after 18:00): 50% of the peak price.',
        'note.missingYear': ' ({year} statutory holidays are not bundled yet, so plain Mon–Fri is assumed — update the plugin.)',
        'tok.hit': 'Input (cache hit)',
        'tok.miss': 'Input (cache miss)',
        'tok.out': 'Output',
        'tok.empty': 'Add a userToken to see the token breakdown',
        'stat.total': 'Total balance',
        'stat.toppedUp': 'Topped up',
        'stat.tokensOf': '{window} tokens',
        'win.today': 'today',
        'win.24h': 'last 24h',
        'win.7d': 'last 7d',
        'win.custom': 'custom',
        'chip.today': 'Today',
        'chip.24h': '24h',
        'chip.7d': '7d',
        'spent.suffix': ' spend',
        'custom.pick': '← pick a start date',
        'custom.note': '(counted from Beijing midnight)',
        'source.official': 'Source: official usage API · all API keys on the account',
        'source.estimate': 'Source: balance-snapshot estimate',
        'source.estimatePartial': ' · only covers the time after the first snapshot, so it can read low',
        'source.none': 'Add an API key or userToken to start measuring',
        'source.failed': ' · official API failed: {error}',
        'models.prefix': 'By model: ',
        'cfg.apiKeyLabel': 'DeepSeek API key (platform.deepseek.com → API keys)',
        'cfg.tokenLabel': 'Platform userToken (optional, exact spend/token stats)',
        'cfg.tokenHint': 'userToken: sign in to platform.deepseek.com, F12 → Local Storage, copy userToken (pasting the whole {"value": "…"} wrapper is fine — the value is extracted). When it expires, measurement falls back to the estimate.',
        'err.request': '⚠ Request failed: {error}',
        'err.unauthorized': 'Session expired: reopen the tokenised URL printed by dsh web, then retry',
        'err.storage': '⚠ Local state file: {error}',
        'dur.days': '{d}d {h}h',
        'dur.hours': '{h}h {m}m',
        'dur.minutes': '{m}m',
        'week': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      },
    }

    /** Fill `{name}` placeholders. */
    function fill(template, vars) {
      if (!vars) return template
      let out = template
      for (const key in vars) out = out.split('{' + key + '}').join(String(vars[key]))
      return out
    }
    /** Build a translator for one locale, falling back to Chinese per key. */
    function makeT(locale) {
      const dict = STRINGS[locale] || STRINGS.zh
      return (key, vars) => fill(dict[key] != null ? dict[key] : (STRINGS.zh[key] != null ? STRINGS.zh[key] : key), vars)
    }

    const LANG_KEY = 'dsb.lang'
    /** An explicit choice by the user in this browser, if any. */
    function loadLangOverride() {
      try {
        const v = localStorage.getItem(LANG_KEY)
        return v === 'zh' || v === 'en' ? v : null
      } catch { return null }
    }
    /**
     * Pick the panel's language: the user's explicit toggle first, then whatever
     * the host reported from its settings document (null when the preference is
     * unset — the host cannot observe the browser's own choice), then the browser.
     */
    function detectLocale(hostLocale) {
      const override = loadLangOverride()
      if (override) return override
      if (hostLocale === 'zh' || hostLocale === 'en') return hostLocale
      const nav = String((typeof navigator !== 'undefined' && navigator.language) || '').toLowerCase()
      if (nav.indexOf('zh') === 0) return 'zh'
      if (nav.indexOf('en') === 0) return 'en'
      return 'zh'
    }

    // Pill position persistence (per browser origin). The pill is moved by
    // press-dragging with the RIGHT mouse button; left click only expands the
    // panel. Right-click on the pill never opens the native context menu
    // because the pill is a drag handle.
    const POS_KEY = 'dsb.widgetPos'
    function loadPos() {
      try {
        const raw = localStorage.getItem(POS_KEY)
        if (!raw) return null
        const p = JSON.parse(raw)
        if (p && typeof p.x === 'number' && typeof p.y === 'number' && Number.isFinite(p.x) && Number.isFinite(p.y)) {
          const vw = window.innerWidth || 0
          const vh = window.innerHeight || 0
          if (vw > 0) return { x: Math.max(0, Math.min(p.x, Math.max(0, vw - 40))), y: Math.max(0, Math.min(p.y, Math.max(0, vh - 20))) }
          return { x: p.x, y: p.y }
        }
      } catch { /* storage unavailable / corrupt value */ }
      return null
    }

    function fmtMoney(n, currency) {
      if (n == null) return '—'
      const sym = currency === 'USD' ? '$' : '¥'
      return sym + n.toFixed(2)
    }
    function fmtNum(n) {
      if (n == null) return '—'
      return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    }
    /** Duration in the current language (`1d 2h` / `1天2小时`). */
    function fmtDuration(t, ms) {
      if (ms < 0) ms = 0
      const d = Math.floor(ms / 86400000)
      const h = Math.floor((ms % 86400000) / 3600000)
      const m = Math.round((ms % 3600000) / 60000)
      if (d > 0) return t('dur.days', { d, h })
      return h > 0 ? t('dur.hours', { h, m }) : t('dur.minutes', { m })
    }
    function balFontSize(text) {
      const n = (text || '').length
      return n <= 7 ? '19px' : n <= 10 ? '16px' : '14px'
    }
    function windowLabel(t, id) {
      if (id === 'today') return t('win.today')
      if (id === '24h') return t('win.24h')
      if (id === '7d') return t('win.7d')
      return t('win.custom')
    }
    function fmtBJTDay(t, ms) {
      const d = new Date(ms + 8 * 3600 * 1000)
      const p = (n) => (n < 10 ? '0' + n : String(n))
      return t('week')[d.getUTCDay()] + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes())
    }
    function fmtModels(models, currency) {
      if (!models || !models.length) return ''
      const sym = currency === 'USD' ? '$' : '¥'
      return models.slice(0, 3).map((m) => m.model + ' ' + sym + m.cost.toFixed(2)).join(' · ')
    }
    /**
     * Phrase the pricing note in the current language from the phase's structured
     * facts. A host that predates `weekend`/`year` only sends its own (Chinese)
     * sentence, which is then used as-is.
     */
    function phaseNote(t, phase) {
      if (!phase) return ''
      const structured = typeof phase.weekend === 'boolean' || typeof phase.year === 'number'
      if (!structured) return phase.note || ''
      let note
      if (phase.mode === 'peak') note = t('note.peak')
      else if (phase.holiday) note = t('note.holiday')
      else if (phase.weekend) note = t('note.weekend')
      else note = t('note.valley')
      if (phase.holidayData === 'missing') note += t('note.missingYear', { year: phase.year })
      return note
    }
    function sourceLine(t, win) {
      if (!win) return '—'
      const failed = win.usageError ? t('source.failed', { error: win.usageError }) : ''
      if (win.source === 'official') return t('source.official') + failed
      if (win.source === 'estimate') return t('source.estimate') + (win.partial ? t('source.estimatePartial') : '') + failed
      return t('source.none')
    }

    /**
     * One request against the plugin's authenticated routes. A rejected request
     * is turned into a message for the panel — never silently swallowed, which is
     * how a missing session cookie used to look like "no data".
     */
    async function api(method, body) {
      const res = await fetch(method === 'GET' ? '/dsbal/state' : '/dsbal/' + method, {
        method: method === 'GET' ? 'GET' : 'POST',
        headers: method === 'GET' ? {} : { 'content-type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(body || {}),
      })
      let payload = null
      try { payload = await res.json() } catch { /* non-JSON error page (401/403/405) */ }
      if (!res.ok) {
        const error = new Error(payload && payload.error ? payload.error : 'HTTP ' + res.status)
        error.status = res.status
        throw error
      }
      return payload
    }

    function Widget() {
      const [data, setData] = React.useState(null)
      const [open, setOpen] = React.useState(false)
      const [cfg, setCfg] = React.useState(false)
      const [apiKey, setApiKey] = React.useState('')
      const [ptoken, setPtoken] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [spinning, setSpinning] = React.useState(false)
      const [pos, setPos] = React.useState(loadPos)
      const [panelPos, setPanelPos] = React.useState(null)
      const [dragging, setDragging] = React.useState(false)
      const [lang, setLang] = React.useState(() => detectLocale(null))
      const [requestError, setRequestError] = React.useState(null)
      const [nowTick, setNowTick] = React.useState(() => Date.now())
      const rootRef = React.useRef(null)
      const panelRef = React.useRef(null)
      const dragRef = React.useRef(null)
      const ctxSuppressRef = React.useRef(false)
      // Browser clock vs host clock, so a countdown stays truthful even when the
      // two machines disagree about the time.
      const clockOffsetRef = React.useRef(0)

      const t = React.useMemo(() => makeT(lang), [lang])
      const applyState = (d) => {
        if (!d || typeof d.nowMs !== 'number') return
        clockOffsetRef.current = d.nowMs - Date.now()
        setData(d)
        setRequestError(null)
        setLang((current) => (loadLangOverride() ? current : detectLocale(d.locale)))
      }
      const load = () => api('GET').then(applyState).catch((err) => setRequestError(err))

      // Poll at the cadence the host reports (it is a configured value now), not a
      // hard-coded 30 s, and skip polling while the tab is hidden.
      const intervalMs = data && typeof data.pollIntervalMs === 'number' && data.pollIntervalMs >= 5000 ? data.pollIntervalMs : 60000
      React.useEffect(() => {
        let cancelled = false
        let timer = null
        const schedule = () => { if (!cancelled) timer = setTimeout(run, intervalMs) }
        const run = async () => {
          if (document.visibilityState === 'visible') await load()
          schedule()
        }
        void load()
        schedule()
        const onVisible = () => { if (document.visibilityState === 'visible') void load() }
        document.addEventListener('visibilitychange', onVisible)
        return () => {
          cancelled = true
          if (timer) clearTimeout(timer)
          document.removeEventListener('visibilitychange', onVisible)
        }
      }, [intervalMs])

      // The countdown is a local clock, so it ticks smoothly without refetching.
      React.useEffect(() => {
        if (!open) return
        const timer = setInterval(() => setNowTick(Date.now()), 1000)
        return () => clearInterval(timer)
      }, [open])

      // --- pill dragging (RIGHT mouse button, press-and-drag) ---
      const startDrag = (ev) => {
        if (ev.button !== 2) return
        const root = rootRef.current
        const r = root ? root.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 }
        dragRef.current = { active: true, sx: ev.clientX, sy: ev.clientY, bx: r.left, by: r.top, w: r.width, h: r.height, moved: false, lastPos: null }
        setDragging(true)
      }
      React.useEffect(() => {
        if (!dragging) return
        const onMove = (ev) => {
          const d = dragRef.current
          if (!d || !d.active) return
          const dx = ev.clientX - d.sx
          const dy = ev.clientY - d.sy
          if (!d.moved && Math.abs(dx) + Math.abs(dy) < 4) return // tiny jitter = not a drag
          d.moved = true
          const vw = window.innerWidth
          const vh = window.innerHeight
          const x = Math.min(Math.max(d.bx + dx, 4), Math.max(4, vw - d.w - 4))
          const y = Math.min(Math.max(d.by + dy, 4), Math.max(4, vh - d.h - 4))
          d.lastPos = { x, y }
          setPos(d.lastPos)
        }
        const onUp = () => {
          const d = dragRef.current
          if (d && d.active) {
            d.active = false
            ctxSuppressRef.current = true // swallow the context menu that follows ANY right-button interaction
            if (d.moved && d.lastPos) { try { localStorage.setItem(POS_KEY, JSON.stringify(d.lastPos)) } catch { /* storage unavailable */ } }
          }
          setDragging(false)
        }
        const prevUserSelect = document.body.style.userSelect
        document.body.style.userSelect = 'none'
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        return () => {
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
          document.body.style.userSelect = prevUserSelect
        }
      }, [dragging])
      // Window resize may have shrunk the viewport under a saved position:
      // clamp the pill back into view so it stays reachable/draggable.
      React.useEffect(() => {
        if (!pos) return
        const clamp = () => {
          const root = rootRef.current
          if (!root) return
          const r = root.getBoundingClientRect()
          const vw = window.innerWidth
          const vh = window.innerHeight
          const x = Math.min(Math.max(r.left, 4), Math.max(4, vw - r.width - 4))
          const y = Math.min(Math.max(r.top, 4), Math.max(4, vh - r.height - 4))
          if (x !== r.left || y !== r.top) setPos({ x, y })
        }
        window.addEventListener('resize', clamp)
        return () => window.removeEventListener('resize', clamp)
      }, [pos])
      // Swallow the context menu that follows a finished RIGHT-button drag
      // (some browsers fire it on mouseup, before React has re-rendered/listeners
      // could be re-attached — so the window listener stays registered and
      // checks the ref instead).
      React.useEffect(() => {
        const h = (ev) => { if (ctxSuppressRef.current) { ev.preventDefault(); ctxSuppressRef.current = false } }
        window.addEventListener('contextmenu', h)
        return () => window.removeEventListener('contextmenu', h)
      }, [])
      // When the pill was moved away from the default corner, keep the expanded
      // panel fully inside the viewport (drag the pill somewhere, open, and the
      // panel flips left/up as needed instead of overflowing off-screen).
      React.useEffect(() => {
        if (!open || !pos) { setPanelPos(null); return }
        const measure = () => {
          const root = rootRef.current
          const panel = panelRef.current
          if (!root || !panel) return
          const r = root.getBoundingClientRect()
          const left = Math.min(r.left, Math.max(8, window.innerWidth - panel.offsetWidth - 8))
          const top = Math.min(r.top, Math.max(8, window.innerHeight - panel.offsetHeight - 8))
          setPanelPos({ left, top })
        }
        measure()
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
      }, [open, pos, data, cfg])

      // Mutating calls share one busy/error path so a failure always reaches the UI.
      const runAction = (promise, done) => {
        if (done) done(true)
        return promise
          .then((d) => { applyState(d); if (done) done(false) })
          .catch((err) => { setRequestError(err); if (done) done(false) })
      }
      const save = () => {
        const payload = {}
        if (apiKey.trim()) payload.apiKey = apiKey.trim()
        if (ptoken.trim()) payload.platformToken = ptoken.trim()
        return runAction(api('config', payload), (on) => setBusy(on)).then(() => {
          setApiKey('')
          setPtoken('')
          setCfg(false)
        })
      }
      const clearKeys = () => runAction(api('config', { clear: true }), (on) => setBusy(on))
      const goWindow = (id) => runAction(api('window', { id }))
      const refreshNow = () => runAction(api('refresh', {}), (on) => setSpinning(on))
      const pickCustom = (ev) => {
        const v = ev && ev.target ? ev.target.value : ''
        if (!v) return
        const parts = v.split('-')
        const utc = Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) - 8 * 3600 * 1000
        return runAction(api('window', { id: 'custom', fromMs: utc }))
      }

      const pillClick = () => setOpen(true) // left click = expand only; right button drags
      const resetPos = () => {
        try { localStorage.removeItem(POS_KEY) } catch { /* storage unavailable */ }
        setPos(null)
        setPanelPos(null)
      }
      const toggleLang = () => {
        const next = lang === 'zh' ? 'en' : 'zh'
        try { localStorage.setItem(LANG_KEY, next) } catch { /* storage unavailable */ }
        setLang(next)
      }
      const pillProps = {
        className: 'dsb-pill',
        onClick: pillClick,
        onMouseDown: startDrag,
        onContextMenu: (ev) => ev.preventDefault(),
        title: t('pill.hint'),
        style: dragging ? { cursor: 'grabbing' } : undefined,
      }
      const rootStyle = pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined
      const requestErrorNode = requestError
        ? e('div', { className: 'dsb-err', key: 'reqerr' }, t('err.request', { error: requestError.status === 401 ? t('err.unauthorized') : requestError.message }))
        : null

      if (!data) {
        const kids = [e('span', { className: 'dsb-muted', key: 'l' }, t('loading'))]
        if (requestErrorNode) kids.push(requestErrorNode)
        return e('div', { ref: rootRef, className: 'dsb-widget', style: rootStyle }, e('div', pillProps, kids))
      }

      const phase = data.phase
      const peak = phase.mode === 'peak'
      const bal = data.balance
      const win = data.window
      const nextLabel = peak ? t('label.valley') : t('label.peak')
      const phaseLabel = peak ? t('label.peak') : t('label.valley')
      const now = nowTick + clockOffsetRef.current

      if (!open) {
        const kids = [
          e('span', { className: 'dsb-dot dsb-dot-' + (peak ? 'peak' : 'valley'), key: 'dot' }),
          e('span', { className: 'dsb-phase-' + (peak ? 'peak' : 'valley'), key: 'ph' }, phaseLabel),
        ]
        if (bal) kids.push(e('span', { className: 'dsb-muted', key: 'b' }, fmtMoney(bal.total, bal.currency)))
        if (win && win.spent != null && bal) kids.push(e('span', { className: 'dsb-muted', key: 's' }, windowLabel(t, win.id) + ' ' + fmtMoney(win.spent, bal.currency)))
        if (!data.configured || !data.configured.apiKey) kids.push(e('span', { className: 'dsb-warn', key: 'n' }, t('pill.configure')))
        if (phase.holiday) kids.push(e('span', { key: 'hd', title: t('pill.holidayTitle') }, '🎉'))
        if (peak) kids.push(e('span', { className: 'dsb-phase-peak', key: 'w' }, '⚠'))
        if (requestErrorNode) kids.push(requestErrorNode)
        return e('div', { ref: rootRef, className: 'dsb-widget', style: rootStyle }, e('div', pillProps, kids))
      }

      const kids = []
      kids.push(e('div', { className: 'dsb-row dsb-head', key: 'head' }, [
        e('span', { className: 'dsb-title', key: 't' }, t('panel.title')),
        e('span', { className: data.keyMask ? 'dsb-src' : 'dsb-warn', key: 'm' }, data.keyMask ? data.keyMask : (data.configured && data.configured.apiKey ? '' : t('status.unconfigured'))),
        e('button', { className: 'dsb-btn', key: 'r', onClick: refreshNow, disabled: spinning }, spinning ? '…' : t('btn.refresh')),
        e('button', { className: 'dsb-btn', key: 'g', onClick: () => setCfg(!cfg) }, cfg ? t('btn.collapse') : t('btn.config')),
        e('button', { className: 'dsb-btn', key: 'lang', onClick: toggleLang, title: t('btn.langTitle') }, t('btn.lang')),
        e('button', { className: 'dsb-btn', key: 'x', onClick: () => setOpen(false), title: t('btn.minimize') }, '−'),
      ]))

      kids.push(e('div', { className: 'dsb-banner ' + (peak ? 'dsb-peak-bg' : 'dsb-valley-bg'), key: 'banner' }, [
        e('div', { className: 'dsb-row', key: 'l1' }, [
          e('span', { className: 'dsb-badge', key: 'b' }, (peak ? '📈 ' : '📉 ') + phaseLabel),
          phase.holiday ? e('span', { className: 'dsb-tag', key: 'hd' }, t('tag.holiday')) : null,
          phase.holidayData === 'missing' ? e('span', { className: 'dsb-tag dsb-tag-warn', key: 'hy' }, t('tag.holidayMissing')) : null,
          e('span', { className: 'dsb-src', key: 't' }, t('range.prefix') + fmtBJTDay(t, phase.startMs) + ' – ' + fmtBJTDay(t, phase.endMs)),
        ]),
        e('div', { className: 'dsb-cd ' + (peak ? 'dsb-err' : 'dsb-muted'), key: 'l2' }, peak
          ? t('countdown.peak', { dur: fmtDuration(t, phase.endMs - now), next: nextLabel })
          : t('countdown.valley', { dur: fmtDuration(t, phase.endMs - now), next: nextLabel })),
        e('div', { className: 'dsb-note dsb-src', key: 'l3' }, phaseNote(t, phase)),
      ]))

      const tok = win && win.tokens
      const tokRows = []
      if (tok && tok.total > 0) {
        tokRows.push(e('div', { className: 'dsb-tokrow', key: 'h' }, [
          e('span', { className: 'dsb-tok-sq', key: 's', style: { background: '#4a9eff' } }),
          e('span', { key: 'l' }, t('tok.hit')),
          e('span', { className: 'dsb-tok-val', key: 'v' }, fmtNum(tok.hit)),
        ]))
        tokRows.push(e('div', { className: 'dsb-tokrow', key: 'm' }, [
          e('span', { className: 'dsb-tok-sq', key: 's', style: { background: '#6db3ff' } }),
          e('span', { key: 'l' }, t('tok.miss')),
          e('span', { className: 'dsb-tok-val', key: 'v' }, fmtNum(tok.miss)),
        ]))
        tokRows.push(e('div', { className: 'dsb-tokrow', key: 'o' }, [
          e('span', { className: 'dsb-tok-sq', key: 's', style: { background: '#a8d4ff' } }),
          e('span', { key: 'l' }, t('tok.out')),
          e('span', { className: 'dsb-tok-val', key: 'v' }, fmtNum(tok.out)),
        ]))
      } else {
        tokRows.push(e('div', { className: 'dsb-src', key: 'n' }, t('tok.empty')))
      }
      kids.push(e('div', { className: 'dsb-stats', key: 'stats' }, [
        e('div', { className: 'dsb-stat', key: 'bal' }, [
          e('div', { className: 'dsb-stat-l', key: 'l1' }, t('stat.total')),
          e('div', { className: 'dsb-stat-v', key: 'v1', style: { fontSize: balFontSize(bal ? fmtMoney(bal.total, bal.currency) : '—') } }, bal ? fmtMoney(bal.total, bal.currency) : '—'),
          e('div', { className: 'dsb-stat-l', key: 'l2', style: { marginTop: 6 } }, t('stat.toppedUp')),
          e('div', { className: 'dsb-stat-v', key: 'v2', style: { fontSize: 14 } }, bal ? fmtMoney(bal.toppedUp, bal.currency) : '—'),
        ]),
        e('div', { className: 'dsb-stat', key: 'tok' }, [
          e('div', { className: 'dsb-stat-l', key: 'l' }, t('stat.tokensOf', { window: win ? windowLabel(t, win.id) : '' }) + (tok ? ' · ' + fmtNum(tok.total) : '') + (win && win.tokenError ? ' · ' + win.tokenError : '')),
          e('div', { key: 'rows', style: { display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 } }, tokRows),
        ]),
      ]))

      const chips = [['today', t('chip.today')], ['24h', t('chip.24h')], ['7d', t('chip.7d')], ['custom', t('win.custom')]]
        .map(([id, label]) => e('button', {
          className: 'dsb-chip' + (win && win.id === id ? ' dsb-chip-on' : ''),
          key: id,
          onClick: () => goWindow(id),
        }, label))
      kids.push(e('div', { className: 'dsb-row', key: 'win' }, chips))
      if (win && win.id === 'custom') {
        kids.push(e('div', { className: 'dsb-row', key: 'cust', style: { alignItems: 'center' } }, [
          e('input', { className: 'dsb-input', key: 'dt', type: 'date', onChange: pickCustom, style: { width: 150 } }),
          e('span', { className: 'dsb-src', key: 'hint' }, win.fromMs == null ? t('custom.pick') : t('custom.note')),
        ]))
      }

      kids.push(e('div', { key: 'spent' }, [
        e('div', { className: 'dsb-row', key: 'r', style: { alignItems: 'baseline', gap: 8 } }, [
          e('span', { className: 'dsb-stat-l', key: 'l' }, (win ? windowLabel(t, win.id) : '') + t('spent.suffix')),
          e('span', { className: 'dsb-spent' + (win && win.spent != null && win.spent > 0 && peak ? ' dsb-err' : ''), key: 'v' }, win ? fmtMoney(win.spent, bal && bal.currency) : '—'),
        ]),
        e('div', { className: 'dsb-src', key: 's' }, sourceLine(t, win)),
        win && win.source === 'official' && win.models && win.models.length
          ? e('div', { className: 'dsb-src', key: 'm' }, t('models.prefix') + fmtModels(win.models, bal && bal.currency))
          : null,
      ]))

      // Reset-to-default entry: only shown once the pill was moved somewhere.
      if (pos) kids.push(e('div', { className: 'dsb-row', key: 'resetpos', style: { justifyContent: 'flex-end' } }, [
        e('button', { className: 'dsb-btn', key: 'r', onClick: resetPos, title: t('btn.resetPosTitle') }, t('btn.resetPos')),
      ]))

      if (requestErrorNode) kids.push(requestErrorNode)
      if (data.lastError) kids.push(e('div', { className: 'dsb-err', key: 'err' }, '⚠ ' + data.lastError))
      if (data.storageError) kids.push(e('div', { className: 'dsb-err', key: 'storerr' }, t('err.storage', { error: data.storageError })))

      if (cfg) kids.push(e('div', { className: 'dsb-field', key: 'cfgwrap', style: { display: 'flex', flexDirection: 'column', gap: 7 } }, [
        e('div', { className: 'dsb-field', key: 'f1' }, [
          e('span', { className: 'dsb-stat-l', key: 'l' }, t('cfg.apiKeyLabel')),
          e('input', { className: 'dsb-input', key: 'i', type: 'password', placeholder: 'sk-…', value: apiKey, onChange: (ev) => setApiKey(ev.target.value) }),
        ]),
        e('div', { className: 'dsb-field', key: 'f2' }, [
          e('span', { className: 'dsb-stat-l', key: 'l' }, t('cfg.tokenLabel')),
          e('input', { className: 'dsb-input', key: 'i', type: 'password', value: ptoken, onChange: (ev) => setPtoken(ev.target.value) }),
        ]),
        e('div', { className: 'dsb-src', key: 'h' }, t('cfg.tokenHint')),
        e('div', { className: 'dsb-row', key: 'b' }, [
          e('button', { className: 'dsb-btn', key: 's', onClick: save, disabled: busy }, busy ? t('btn.saving') : t('btn.save')),
          e('button', { className: 'dsb-btn', key: 'x', onClick: clearKeys, disabled: busy }, t('btn.clear')),
        ]),
      ]))

      return e('div', { ref: rootRef, className: 'dsb-widget', style: rootStyle }, e('div', { ref: panelRef, className: 'dsb-panel', style: panelPos ? { position: 'fixed', left: panelPos.left, top: panelPos.top } : undefined }, kids))
    }

    // dsh ≥ 0.1.2-rc.1: the fiber's service gate comes from the module exports'
    // `inject` (the loader passes all module exports as an object plugin ->
    // Inject.resolve(plugin.inject)). Without the declaration the fiber activates
    // before the 'slots' service exists and sibling fibers never see each other's
    // provided services, so the widget was silently dropped. 'slots' is provided
    // by the renderer package (dsh-client-ui-renderer).
    const inject = ['slots']

    function apply(ctx) {
      let slots
      try { slots = ctx.get('slots') } catch { /* cordis variants expose get differently */ }
      if (!slots) { try { slots = ctx.slots } catch { /* older cordis throws on undeclared property access */ } }
      if (!slots) {
        console.error('[deepseek-balance] slots service unavailable; widget not mounted')
        return
      }
      const styleDisposers = []
      try {
        const styleEl = document.createElement('style')
        styleEl.textContent = CSS
        document.head.appendChild(styleEl)
        styleDisposers.push(() => styleEl.remove())
      } catch { /* styles.insert not available; fall back to head injection */ }
      slots.inject('shell.overlay', () => slots.register({ name: 'shell.overlay', id: 'deepseek-balance' }, () => e(Widget, null)))
      ctx.effect(() => () => { for (const d of styleDisposers) d() })
    }

    exports.inject = inject
    exports.apply = apply

    return module.exports
  },
})
