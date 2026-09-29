# dsh-deepseek-balance

[![test](https://github.com/OwlNjust/DSH-DeepSeek-Balance/actions/workflows/test.yml/badge.svg)](https://github.com/OwlNjust/DSH-DeepSeek-Balance/actions/workflows/test.yml)

> DeepSeek balance & usage monitor for **DeepSeek Harness** — a floating widget at the
> bottom-right corner with a peak/off-peak (梁文峰 / 梁文谷) price reminder.
>
> **[中文](README.zh.md) · English**

---

**Installation is one step:** send `https://github.com/OwlNjust/DSH-DeepSeek-Balance`
to your agent — it knows how to install this plugin. Manual steps are below.

## Installation (agent-friendly, no npm needed)

This package has **zero runtime dependencies and is never published to npm**. There are two
routes — **pick exactly one per profile**; using both inserts the plugin id twice (see
"Agent notes").

### Route A (recommended): install it as a profile *bundle* (deepseek-harness ≥ 0.2.0)

The package declares `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`, so the harness
plugin manager can install and activate it as a profile layer — **no file editing at all**:

- **Desktop app**: menu bar → “Manage plugins” → enter
  `https://github.com/OwlNjust/DSH-DeepSeek-Balance`
- **CLI**:

  ```sh
  dsh plugin --profile <profile> add https://github.com/OwlNjust/DSH-DeepSeek-Balance
  ```

The manager adds the package to the profile's `dsh.profile.bundles`, and the `cordis.patch.yml`
shipped inside the package (it carries the `insert` row that activates the plugin) is applied as
a bundle layer. After a reload/restart the bottom-right widget appears.

### Route B: local checkout + the profile's patch layer (offline / source debugging)

```sh
# 1. Clone or copy the repository anywhere
git clone https://github.com/OwlNjust/DSH-DeepSeek-Balance.git /tmp/dsh-deepseek-balance

# 2. Install it into the web profile (file: = snapshot; link: = live symlink)
cd ~/.dsh/profiles/web
dsh plugin --profile web add link:/tmp/dsh-deepseek-balance
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

- Do **not** run `npm publish`; installation is git/checkout based.
- **Do not mix the routes**: route A already inserts the plugin row from the bundle layer, so
  also appending the same `insert` row by hand inserts the plugin id twice (cordis collapses
  rows that share an id into one, so this **fails silently** — it only leaves a duplicate row
  in the composed tree, which is easy to misread later). When switching, make sure only
  `dsh.profile.bundles` or the profile's `cordis.patch.yml` carries it. One-line self-check —
  the result must be `1`:

  ```sh
  dsh --profile web --dump-config | grep -c 'id: dsh-deepseek-balance'
  ```

  If it prints `2`, delete the hand-written block from `cordis.patch.yml` (keep the package in
  `dsh.profile.bundles`, the bundle layer is maintained by the plugin manager) and restart
  `dsh web`. To switch the other way, remove the package from `dsh.profile.bundles` first.
- Configuration and balance history are stored in `~/.deepseek-balance.json`
  (mode 0600) — never echo its contents.
- Uninstall: remove the row from `cordis.patch.yml`, delete
  `~/.dsh/profiles/web/node_modules/dsh-deepseek-balance`, restart `dsh web`.

## Requirements

- A DeepSeek Harness deployment with the **web profile** (`dsh web`); Node.js ≥ 20
  (adapted and verified on **v0.1.2-rc.1**, re-checked up to **v0.2.0-rc.2** — it has
  worked unchanged across all four versions).
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

After touching the phase algorithm (the `phase:begin`/`phase:end` block in `lib/index.js`),
the `/dsbal/*` request validation (`requests:begin`/`requests:end`) or the packaging
declaration (`dsh.bundle` in `package.json` / the shipped `cordis.patch.yml`) run `npm test`
(53 cases): `test/phase.test.mjs` (28 cases: weekdays / weekends / statutory holidays / merged
holiday runs / unlisted-year fallback), `test/routes.test.mjs` (14 cases: an invalid id, a
non-JSON body or a wrong field type must answer 400 and change no state) and
`test/package.test.mjs` (11 cases: package name, a single `insert` row in the bundle layer,
the client artifact format plus `exports.inject`, the host `inject` and the test markers).
The first two extract the very code they test from `lib/index.js`.

## License

[MIT](LICENSE)
