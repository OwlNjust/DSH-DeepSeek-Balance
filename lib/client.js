// dsh-deepseek-balance — client half.
// Browser module artefact consumed by the dsh web client module system
// (window.__ModuleLoader__). The widget is registered in the shell.overlay
// slot (bottom-right floating card) and talks to the host plugin through
// same-origin /dsbal/* HTTP routes.
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
      ''

    function fmtMoney(n, currency) {
      if (n == null) return '—'
      const sym = currency === 'USD' ? '$' : '¥'
      return sym + n.toFixed(2)
    }
    function fmtNum(n) {
      if (n == null) return '—'
      return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    }
    function fmtDuration(ms) {
      if (ms < 0) ms = 0
      const d = Math.floor(ms / 86400000)
      const h = Math.floor((ms % 86400000) / 3600000)
      const m = Math.round((ms % 3600000) / 60000)
      if (d > 0) return d + '天' + h + '小时'
      return h > 0 ? h + '小时' + m + '分' : m + '分钟'
    }
    function balFontSize(text) {
      const n = (text || '').length
      return n <= 7 ? '19px' : n <= 10 ? '16px' : '14px'
    }
    const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    function fmtBJTDay(ms) {
      const d = new Date(ms + 8 * 3600 * 1000)
      const p = (n) => (n < 10 ? '0' + n : String(n))
      return WEEK[d.getUTCDay()] + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes())
    }
    function fmtBJT(ms) {
      const d = new Date(ms + 8 * 3600 * 1000)
      const p = (n) => (n < 10 ? '0' + n : String(n))
      return p(d.getUTCHours()) + ':' + p(d.getUTCMinutes())
    }
    function windowLabel(id) {
      if (id === 'today') return '今日'
      if (id === '24h') return '近24小时'
      if (id === '7d') return '近7天'
      return '自定义'
    }
    function fmtModels(models, currency) {
      if (!models || !models.length) return ''
      const sym = currency === 'USD' ? '$' : '¥'
      return models.slice(0, 3).map((m) => m.model + ' ' + sym + m.cost.toFixed(2)).join(' · ')
    }
    function sourceLine(win) {
      if (!win) return '—'
      if (win.source === 'official') return '数据来源：官方用量接口 · 账号全部 API Key 合计' + (win.usageError ? ' · 官方接口失败：' + win.usageError : '')
      if (win.source === 'estimate') return '数据来源：余额快照估算' + (win.partial ? ' · 仅覆盖快照开始之后，可能偏低' : '') + (win.usageError ? ' · 官方接口失败：' + win.usageError : '')
      return '配置 API Key 或平台令牌后开始统计'
    }

    async function api(method, body) {
      const res = await fetch(method === 'GET' ? '/dsbal/state' : '/dsbal/' + method, {
        method: method === 'GET' ? 'GET' : 'POST',
        headers: method === 'GET' ? {} : { 'content-type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(body || {}),
      })
      return res.json()
    }

    function Widget() {
      const [data, setData] = React.useState(null)
      const [open, setOpen] = React.useState(false)
      const [cfg, setCfg] = React.useState(false)
      const [apiKey, setApiKey] = React.useState('')
      const [ptoken, setPtoken] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [spinning, setSpinning] = React.useState(false)

      const load = () => api('GET').then((d) => { if (d && d.nowMs) setData(d) }).catch(() => {})
      React.useEffect(() => {
        load()
        const t = setInterval(load, 30000)
        return () => clearInterval(t)
      }, [])

      const save = () => {
        const payload = {}
        if (apiKey.trim()) payload.apiKey = apiKey.trim()
        if (ptoken.trim()) payload.platformToken = ptoken.trim()
        setBusy(true)
        api('config', payload).then((d) => {
          setBusy(false)
          setCfg(false)
          setApiKey('')
          setPtoken('')
          if (d && d.nowMs) setData(d)
        }).catch(() => setBusy(false))
      }
      const clearKeys = () => {
        setBusy(true)
        api('config', { clear: true }).then((d) => {
          setBusy(false)
          if (d && d.nowMs) setData(d)
        }).catch(() => setBusy(false))
      }
      const goWindow = (id) => api('window', { id }).then((d) => { if (d && d.nowMs) setData(d) }).catch(() => {})
      const refreshNow = () => {
        setSpinning(true)
        api('refresh', {}).then((d) => {
          setSpinning(false)
          if (d && d.nowMs) setData(d)
        }).catch(() => setSpinning(false))
      }
      const pickCustom = (ev) => {
        const v = ev && ev.target ? ev.target.value : ''
        if (!v) return
        const parts = v.split('-')
        const utc = Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) - 8 * 3600 * 1000
        api('window', { id: 'custom', fromMs: utc }).then((d) => { if (d && d.nowMs) setData(d) }).catch(() => {})
      }

      if (!data) return e('div', { className: 'dsb-widget' }, e('div', { className: 'dsb-pill', onClick: () => setOpen(true) }, e('span', { className: 'dsb-muted' }, '余额加载中…')))

      const phase = data.phase
      const peak = phase.mode === 'peak'
      const bal = data.balance
      const win = data.window
      const nextLabel = peak ? '梁文谷' : '梁文峰'

      if (!open) {
        const kids = [
          e('span', { className: 'dsb-dot dsb-dot-' + (peak ? 'peak' : 'valley'), key: 'dot' }),
          e('span', { className: 'dsb-phase-' + (peak ? 'peak' : 'valley'), key: 'ph' }, phase.label),
        ]
        if (bal) kids.push(e('span', { className: 'dsb-muted', key: 'b' }, fmtMoney(bal.total, bal.currency)))
        if (win && win.spent != null && bal) kids.push(e('span', { className: 'dsb-muted', key: 's' }, windowLabel(win.id) + ' ' + fmtMoney(win.spent, bal.currency)))
        if (!data.configured || !data.configured.apiKey) kids.push(e('span', { className: 'dsb-warn', key: 'n' }, '点击配置 API Key'))
        if (peak) kids.push(e('span', { className: 'dsb-phase-peak', key: 'w' }, '⚠'))
        return e('div', { className: 'dsb-widget' }, e('div', { className: 'dsb-pill', onClick: () => setOpen(true) }, kids))
      }

      const kids = []
      kids.push(e('div', { className: 'dsb-row dsb-head', key: 'head' }, [
        e('span', { className: 'dsb-title', key: 't' }, 'DeepSeek 余额'),
        e('span', { className: data.keyMask ? 'dsb-src' : 'dsb-warn', key: 'm' }, data.keyMask ? data.keyMask : (data.configured && data.configured.apiKey ? '' : '未配置')),
        e('button', { className: 'dsb-btn', key: 'r', onClick: refreshNow, disabled: spinning }, spinning ? '…' : '刷新'),
        e('button', { className: 'dsb-btn', key: 'g', onClick: () => setCfg(!cfg) }, cfg ? '收起' : '配置'),
        e('button', { className: 'dsb-btn', key: 'x', onClick: () => setOpen(false) }, '−'),
      ]))

      kids.push(e('div', { className: 'dsb-banner ' + (peak ? 'dsb-peak-bg' : 'dsb-valley-bg'), key: 'banner' }, [
        e('div', { className: 'dsb-row', key: 'l1' }, [
          e('span', { className: 'dsb-badge', key: 'b' }, (peak ? '📈 ' : '📉 ') + phase.label),
          e('span', { className: 'dsb-src', key: 't' }, '北京 ' + fmtBJTDay(phase.startMs) + ' – ' + fmtBJTDay(phase.endMs)),
        ]),
        e('div', { className: 'dsb-cd ' + (peak ? 'dsb-err' : 'dsb-muted'), key: 'l2' }, peak
          ? '高价 ×2 · ' + fmtDuration(phase.endMs - data.nowMs) + '后切' + nextLabel + '，省着点用！'
          : '半价 · ' + fmtDuration(phase.endMs - data.nowMs) + '后切' + nextLabel),
        e('div', { className: 'dsb-note dsb-src', key: 'l3' }, phase.note),
      ]))

      const tok = win && win.tokens
      const tokRows = []
      if (tok && tok.total > 0) {
        tokRows.push(e('div', { className: 'dsb-tokrow', key: 'h' }, [
          e('span', { className: 'dsb-tok-sq', key: 's', style: { background: '#4a9eff' } }),
          e('span', { key: 'l' }, '输入（命中缓存）'),
          e('span', { className: 'dsb-tok-val', key: 'v' }, fmtNum(tok.hit)),
        ]))
        tokRows.push(e('div', { className: 'dsb-tokrow', key: 'm' }, [
          e('span', { className: 'dsb-tok-sq', key: 's', style: { background: '#6db3ff' } }),
          e('span', { key: 'l' }, '输入（未命中缓存）'),
          e('span', { className: 'dsb-tok-val', key: 'v' }, fmtNum(tok.miss)),
        ]))
        tokRows.push(e('div', { className: 'dsb-tokrow', key: 'o' }, [
          e('span', { className: 'dsb-tok-sq', key: 's', style: { background: '#a8d4ff' } }),
          e('span', { key: 'l' }, '输出'),
          e('span', { className: 'dsb-tok-val', key: 'v' }, fmtNum(tok.out)),
        ]))
      } else {
        tokRows.push(e('div', { className: 'dsb-src', key: 'n' }, '配置 userToken 后显示 Token 明细'))
      }
      kids.push(e('div', { className: 'dsb-stats', key: 'stats' }, [
        e('div', { className: 'dsb-stat', key: 'bal' }, [
          e('div', { className: 'dsb-stat-l', key: 'l1' }, '总余额'),
          e('div', { className: 'dsb-stat-v', key: 'v1', style: { fontSize: balFontSize(bal ? fmtMoney(bal.total, bal.currency) : '—') } }, bal ? fmtMoney(bal.total, bal.currency) : '—'),
          e('div', { className: 'dsb-stat-l', key: 'l2', style: { marginTop: 6 } }, '充值余额'),
          e('div', { className: 'dsb-stat-v', key: 'v2', style: { fontSize: 14 } }, bal ? fmtMoney(bal.toppedUp, bal.currency) : '—'),
        ]),
        e('div', { className: 'dsb-stat', key: 'tok' }, [
          e('div', { className: 'dsb-stat-l', key: 'l' }, (win ? windowLabel(win.id) : '') + ' Token 消耗' + (tok ? ' · ' + fmtNum(tok.total) : '') + (win && win.tokenError ? ' · ' + win.tokenError : '')),
          e('div', { key: 'rows', style: { display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 } }, tokRows),
        ]),
      ]))

      const wins = [['today', '今天'], ['24h', '24h'], ['7d', '7天'], ['custom', '自定义']]
      const chips = wins.map(([id, label]) => e('button', {
        className: 'dsb-chip' + (win && win.id === id ? ' dsb-chip-on' : ''),
        key: id,
        onClick: () => goWindow(id),
      }, label))
      kids.push(e('div', { className: 'dsb-row', key: 'win' }, chips))
      if (win && win.id === 'custom') {
        kids.push(e('div', { className: 'dsb-row', key: 'cust', style: { alignItems: 'center' } }, [
          e('input', { className: 'dsb-input', key: 'dt', type: 'date', onChange: pickCustom, style: { width: 150 } }),
          e('span', { className: 'dsb-src', key: 'hint' }, win.fromMs == null ? '← 选择开始日期' : '（北京时间零点起算）'),
        ]))
      }

      kids.push(e('div', { key: 'spent' }, [
        e('div', { className: 'dsb-row', key: 'r', style: { alignItems: 'baseline', gap: 8 } }, [
          e('span', { className: 'dsb-stat-l', key: 'l' }, (win ? windowLabel(win.id) : '') + '消耗'),
          e('span', { className: 'dsb-spent' + (win && win.spent != null && win.spent > 0 && peak ? ' dsb-err' : ''), key: 'v' }, win ? fmtMoney(win.spent, bal && bal.currency) : '—'),
        ]),
        e('div', { className: 'dsb-src', key: 's' }, sourceLine(win)),
        win && win.source === 'official' && win.models && win.models.length
          ? e('div', { className: 'dsb-src', key: 'm' }, '按模型：' + fmtModels(win.models, bal && bal.currency))
          : null,
      ]))

      if (data.lastError) kids.push(e('div', { className: 'dsb-err', key: 'err' }, '⚠ ' + data.lastError))

      if (cfg) kids.push(e('div', { className: 'dsb-field', key: 'cfgwrap', style: { display: 'flex', flexDirection: 'column', gap: 7 } }, [
        e('div', { className: 'dsb-field', key: 'f1' }, [
          e('span', { className: 'dsb-stat-l', key: 'l' }, 'DeepSeek API Key（platform.deepseek.com → API keys）'),
          e('input', { className: 'dsb-input', key: 'i', type: 'password', placeholder: 'sk-…', value: apiKey, onChange: (ev) => setApiKey(ev.target.value) }),
        ]),
        e('div', { className: 'dsb-field', key: 'f2' }, [
          e('span', { className: 'dsb-stat-l', key: 'l' }, '平台令牌 userToken（可选，精确统计 Token/消耗）'),
          e('input', { className: 'dsb-input', key: 'i', type: 'password', value: ptoken, onChange: (ev) => setPtoken(ev.target.value) }),
        ]),
        e('div', { className: 'dsb-src', key: 'h' }, 'userToken：登录 platform.deepseek.com 后 F12 → Local Storage 复制 userToken（可直接粘贴 {"value": "…"} 整段，自动提取）。失效自动回退为估算。'),
        e('div', { className: 'dsb-row', key: 'b' }, [
          e('button', { className: 'dsb-btn', key: 's', onClick: save, disabled: busy }, busy ? '保存中…' : '保存'),
          e('button', { className: 'dsb-btn', key: 'x', onClick: clearKeys, disabled: busy }, '清除'),
        ]),
      ]))

      return e('div', { className: 'dsb-widget' }, e('div', { className: 'dsb-panel' }, kids))
    }

    exports.apply = function (ctx) {
      const slots = ctx.get('slots')
      if (!slots) return
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

    return module.exports
  },
})
