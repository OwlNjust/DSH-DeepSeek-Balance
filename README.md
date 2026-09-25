# dsh-deepseek-balance

> DeepSeek balance & usage monitor for **DeepSeek Harness** — a floating widget at the
> bottom-right corner with a peak/off-peak (梁文峰 / 梁文谷) price reminder.
>
> **[中文](README.zh.md) · English**

---

**Installation is one step:** send `https://github.com/OwlNjust/DSH-DeepSeek-Balance`
to your agent — it knows how to install this plugin. Manual steps are below.

## Installation (agent-friendly, no npm needed)

This package is installed **from a local checkout** — it has zero runtime
dependencies and is never published to npm. An agent (or human) can follow
these exact steps:

```sh
# 1. Clone or copy the repository into the profile's reach (any path works)
git clone https://github.com/OwlNjust/DSH-DeepSeek-Balance.git /tmp/dsh-deepseek-balance

# 2. Install it into the web profile (file: = snapshot; link: = live symlink)
cd ~/.dsh/profiles/web
dsh plugin --profile web add file:/tmp/dsh-deepseek-balance
```

3. Append this block to `~/.dsh/profiles/web/cordis.patch.yml` (the profile's
   user patch layer):

```yaml
- insert:
    - id: dsh-deepseek-balance
      name: dsh-deepseek-balance
```

4. Restart the profile:

```sh
dsh web
```

5. Verify (optional): check that the web server answers

```sh
curl -s http://127.0.0.1:3080/dsbal/state
```

and that the bottom-right widget appears after a hard page refresh
(Ctrl+Shift+R). Have the user click the widget → **配置** → paste their
DeepSeek **API key** (and, optionally, the platform **userToken**) → **保存**.

### Agent notes

- Do **not** run `npm publish`; installation is checkout-copy based.
- Configuration and balance history are stored in `~/.deepseek-balance.json`
  (mode 0600) — never echo its contents.
- Uninstall: remove the row from `cordis.patch.yml`, delete
  `~/.dsh/profiles/web/node_modules/dsh-deepseek-balance`, restart `dsh web`.

## Requirements

- A DeepSeek Harness deployment with the **web profile** (`dsh web`); Node.js ≥ 20
  (verified against deepseek-harness **v0.1.2-rc.1**).
- A DeepSeek **API key** (platform.deepseek.com → API keys).
- Optional: platform **userToken** (platform.deepseek.com → DevTools → Application →
  Local Storage) for exact cost/token stats. Without it, consumption falls back
  to balance-snapshot estimates.

## Features

- **Balance** — total and topped-up balance via the official `GET /user/balance`, polled every 5 min.
- **Period consumption** — today / 24h / 7d / custom start date, with per-model breakdown (`/usage/cost`).
- **Token usage** — cache-hit input / cache-miss input / output, identical to the platform dashboard (`/usage/amount`).
- **Price window reminder** — 🔴 **梁文峰** (peak: Beijing Mon–Fri 09:00–12:00 & 14:00–18:00,
  **excluding Chinese statutory holidays**, ×2 price) vs 🟢 **梁文谷** (off-peak: everything else,
  **including weekends and statutory holidays all day**, 50% price), live countdown,
  red highlight during peak and a 🎉 badge on holidays. Windows follow the
  [official pricing docs](https://api-docs.deepseek.com/zh-cn/quick_start/pricing).
- **Draggable placement** — **right-click press-and-drag** the pill to move it anywhere;
  the position is remembered automatically (left click simply expands the panel).
  Right-clicking the pill never opens the browser menu (the pill is a drag handle by design).
  The expanded panel auto-fits the viewport edges, and the pill is clamped back into view
  after window resizes. A「重置位置（右下角）」button at the panel bottom restores the
  default bottom-right position.

## Usage

| Thing | Where |
| --- | --- |
| API key / userToken | widget → 配置 |
| Time window | widget chips (今天 / 24h / 7天 / custom) |
| Refresh | 刷新 button (or automatic: every 5 min / 30 s) |
| Pill summary | bottom-right: current price window + balance + period spend |

## Architecture

```
host plugin lib/index.js     poll (fetch) → ~/.deepseek-balance.json
                             serve JSON: /dsbal/state|refresh|config|window
client module lib/client.js  window.__ModuleLoader__ artifact
                             registers the shell.overlay widget; fetch() the routes
```

## Notes

- `/usage/cost` and `/usage/amount` are **private** platform-dashboard endpoints
  (not in the public docs) and may change; the plugin degrades to estimates
  automatically. Usage figures are **account-wide** — the platform API does not
  filter by API key.
- A `userToken` expires naturally; usage may lag by up to 1 hour (memory cache);
  the 刷新 button clears it.
- Keys are stored unencrypted in `~/.deepseek-balance.json` (0600) — never share it.
- Statutory holidays come from the **annual State Council notice** and are currently
  bundled for **2026**. After the new year the plugin must be updated to know the next
  year's holidays; an unlisted year is flagged「节假日数据待更新」and judged as plain
  Mon–Fri until then.

## Contributing

Issues and PRs welcome (peak-hour threshold alerts, per-model filtering, locales…).
Keep `lib/client.js` in the `window.__ModuleLoader__` artifact format.

After touching the phase algorithm (the `phase:begin`/`phase:end` block in `lib/index.js`)
run `npm test`: `test/phase.test.mjs` extracts that very block and asserts 28 cases
(weekdays / weekends / statutory holidays / merged holiday runs / unlisted-year fallback).

## License

[MIT](LICENSE)
