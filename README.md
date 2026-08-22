# dsh-deepseek-balance

A persistent [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
plugin that monitors your DeepSeek account balance and API usage, with a
bottom-right floating widget.


## Features

- **Real-time balance** — total available balance and topped-up (recharge)
  balance from the official `GET /user/balance` endpoint (polled every 5 min).
- **Period consumption** — 今天 / 近24小时 / 近7天 / custom start date,
  with per-model breakdown (`/usage/cost`).
- **Token usage in three categories** — 输入(命中缓存) / 输入(未命中缓存) /
  输出, the same official platform numbers (`/usage/amount`).
- **Liang Wenfeng / Liang Wengu price reminder** — the widget shows the
  current price window at a glance: 🔴 梁文峰 = peak hours
  (Beijing 09:00–12:00, 14:00–18:00, ×2 price) and 🟢 梁文谷 = off-peak
  (everything else, ~50% price), with a countdown to the next switch. Peak
  hours are highlighted in red to discourage heavy API use.
- **Faithful to the official docs** — pricing windows follow
  <https://api-docs.deepseek.com/zh-cn/quick_start/pricing>.

## Requirements

- A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
  deployment with the **web profile** (`dsh web`).
- A DeepSeek **API key** (platform.deepseek.com → API keys).
- Optional: the platform **userToken** (from `platform.deepseek.com` →
  DevTools → Application → Local Storage) for exact per-day cost/token
  statistics. Without it the plugin falls back to balance-snapshot estimates.

## Installation

From your dsh installation:

```sh
cd ~/.dsh/profiles/web
dsh plugin --profile web add file:../<path-to>/dsh-deepseek-balance
```

Then append this block to `~/.dsh/profiles/web/cordis.patch.yml`
(the profile's user patch layer):

```yaml
- insert:
    - id: dsh-deepseek-balance
      name: dsh-deepseek-balance
```

Restart the profile (`dsh web`). The widget appears in the bottom-right
corner; click it to expand, use **配置** to paste your API key (and the
optional platform userToken), then click **保存**.

> npm distribution: after `npm publish`, users can simply run
> `dsh plugin --profile web add dsh-deepseek-balance`.

## Persistence

Unlike session-local dynamic plugins, this is a regular composition plugin:
it is loaded by the profile at startup, so **it survives `dsh` restarts**.
All configuration and balance-snapshot history are stored in
`~/.deepseek-balance.json`.

## Configuration

| Field | Where | Purpose |
| --- | --- | --- |
| API Key | widget → 配置 | required; balance endpoint |
| userToken | widget → 配置 | optional; exact usage endpoints |
| Time window | widget chips | 今天 / 24h / 7天 / custom |

## How it works

```
┌──────────────────────────── dsh web profile ────────────────────────────┐
│ host plugin (lib/index.js)                                              │
│   · polls balance + usage every 5 min (fetch)                           │
│   · persists to ~/.deepseek-balance.json                                │
│   · serves JSON at /dsbal/state | /dsbal/refresh | /dsbal/config |       │
│     /dsbal/window (same-origin HTTP on the harness web server)          │
│                                                                          │
│ client module (lib/client.js, window.__ModuleLoader__ artifact)          │
│   · registers the bottom-right widget in the shell.overlay slot          │
│   · fetch()s the /dsbal/* routes; refreshes every 30 s                   │
└──────────────────────────────────────────────────────────────────────────┘
```

## Disclaimer

- The `/usage/cost` and `/usage/amount` endpoints are private
  platform-dashboard endpoints (not in the public API docs); they may change
  without notice. The plugin degrades gracefully to balance-snapshot
  estimation when they are unavailable.
- Never share your API key or userToken: they are stored unencrypted in
  `~/.deepseek-balance.json` (mode 0600).

## Contributing

Issues, PRs and feature ideas are welcome (threshold alerts, per-model
filtering, …). Please keep the client half in sync with the
`window.__ModuleLoader__` artifact format used by dsh's web client module
system.

## License

MIT
