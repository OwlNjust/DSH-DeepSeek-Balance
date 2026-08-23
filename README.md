# dsh-deepseek-balance

> Real-time DeepSeek balance & usage monitor for **DeepSeek Harness** — a floating
> widget at the bottom-right corner that reminds you when API prices peak.
>
> **[中文](README.zh.md) · English**

## Features

- **Balance** — total and topped-up balance from the official `GET /user/balance`, refreshed every 5 minutes.
- **Period consumption** — today / 24h / 7d / custom start date, with per-model breakdown (`/usage/cost`).
- **Token usage** — cache-hit input / cache-miss input / output, same numbers as the platform dashboard (`/usage/amount`).
- **Price window reminder** — 🔴 **梁文峰** (peak: Beijing Mon–Fri 09:00–12:00, 14:00–18:00, ×2 price) vs 🟢 **梁文谷** (off-peak: everything else incl. weekends, ~50% price), with a live countdown. Peak is highlighted in red to discourage heavy API use.

Pricing windows follow the [official docs](https://api-docs.deepseek.com/zh-cn/quick_start/pricing).

## Requirements

- A DeepSeek Harness deployment with the **web profile** (`dsh web`).
- A DeepSeek **API key** (platform.deepseek.com → API keys).
- Optional: platform **userToken** for exact cost/token statistics (from `platform.deepseek.com` → DevTools → Application → Local Storage). Without it, consumption falls back to balance-snapshot estimates.

## Installation

```sh
cd ~/.dsh/profiles/web
dsh plugin --profile web add file:../<path-to>/dsh-deepseek-balance
```

Append to `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: dsh-deepseek-balance
      name: dsh-deepseek-balance
```

Restart the profile (`dsh web`). Click the widget → **配置** → paste your API key (and the optional userToken) → **保存**.

> Published to npm, installation is one command: `dsh plugin --profile web add dsh-deepseek-balance`.

## Usage

| Thing | Where |
| --- | --- |
| API key / userToken | widget → 配置 |
| Time window | widget chips (今天 / 24h / 7天 / custom) |
| Refresh | 刷新 button (or automatic every 5 min / 30 s) |
| Pill summary | bottom-right: current price window + balance + period spend |

## Persistence

A regular composition plugin, loaded by the profile at startup — it **survives `dsh` restarts**. All configuration and balance-snapshot history live in `~/.deepseek-balance.json` (mode 0600); never share that file.

## Architecture

```
host plugin lib/index.js     poll (fetch) → ~/.deepseek-balance.json
                             serve JSON at /dsbal/state|refresh|config|window
client module lib/client.js  window.__ModuleLoader__ artifact
                             registers the shell.overlay widget; fetch() the routes
```

## Notes

- `/usage/cost` and `/usage/amount` are **private** platform-dashboard endpoints (not in the public docs) and may change; the plugin degrades to snapshots automatically. Usage data is **account-wide** — the platform API does not filter by API key.
- A `userToken` naturally expires; usage data may lag by up to 1 hour (memory caching); hit 刷新 for fresh numbers.
- Node.js ≥ 20 recommended (global `fetch` + `AbortSignal.timeout`).

## Contributing

Issues and PRs welcome — e.g. threshold alerts for peak-hour spending, per-model filtering, more locales. Keep `lib/client.js` in the `window.__ModuleLoader__` artifact format.

## License

[MIT](LICENSE)
