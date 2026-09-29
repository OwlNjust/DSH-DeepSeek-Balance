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
  red highlight during peak and a 🎉 badge on holidays. The price windows follow the
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
| Refresh | 刷新 button (or automatic, at the configured `pollIntervalMs` — 5 min by default; paused while the tab is hidden) |
| Language | follows the host's preference, else the browser's; the `EN/中` button in the panel header switches manually (remembered locally) |
| Pill summary | bottom-right: current price window + balance + period spend |

## Architecture

```
host lib/index.js       assembly only: validate config → build store/service → register four
                        authenticated routes → poll on a timer
  ├─ lib/service.js     the operations (getState / refresh / setConfig / setWindow / poll)
  ├─ lib/config.js      tunables + DEFAULTS validation (a profile `config:` replaces wholesale)
  ├─ lib/store.js       state file: atomic write (temp file + rename), serialised, schemaVersion
  │                     envelope, quarantines a corrupt file instead of losing it
  ├─ lib/deepseek.js    balance/usage HTTP client (browser-ish headers, 15 s timeout) + parsing
  ├─ lib/phase.js       peak/off-peak phases + the statutory-holiday calendar
  ├─ lib/window.js      window range, snapshot estimation, daily cost/token aggregation
  ├─ lib/validate.js    /dsbal/* request validation (fromMs bounds, credential length/shape)
  └─ lib/i18n.js        reads the host's language preference
client lib/client.js   window.__ModuleLoader__ artifact: the shell.overlay widget + zh/en copy
```

**Authentication**: all four `/dsbal/*` routes pass the host's own gate first —
`ctx.connection.admit(req)`, the same Host/Origin trust fence and browser-cookie
authentication the `/api` channel uses. A request without a session cookie gets
**401**, a cross-site request **403**, a wrong method **405**, and a malformed body
**400 with no state change**. The credential-writing route is reachable only from the
authenticated local browser.

## Configuration

Override fields per entry id in the profile's patch layer (`config:` replaces the whole
object, so unlisted fields fall back to the defaults):

```yaml
- id: dsh-deepseek-balance
  config:
    pollIntervalMs: 900000     # poll cadence, 30s .. 24h, default 5 min
    historyDays: 180           # snapshot retention / custom-window cap, 1 .. 400, default 90
    usageTtlMs: 1800000        # successful usage-response cache, 1min .. 24h, default 1 h
    usageErrorTtlMs: 600000    # failed usage-response cache, 1min .. 24h, default 10 min
    maxSnapshots: 5000         # snapshot cap, 100 .. 100000
    requestTimeoutMs: 15000    # per-request timeout, 1s .. 120s
```

The endpoints (`balanceUrl` / `usageCostUrl` / `usageAmountUrl`) are overridable too and
must be https. An invalid value **fails activation naming the field** instead of falling
back silently.

## Model access (read-only agent tool)

The plugin registers one read-only tool through an optional injection, so a profile
without a tool runtime still activates the widget:

| Tool | Parameters | Returns |
| --- | --- | --- |
| `deepseek_balance` | `window` (`today`\|`24h`\|`7d`\|`custom`, optional), `fromMs` (epoch ms, only with `custom`) | current price phase, balance, the period's spend and token counters, configuration state and the last error |

It is **read-only by construction**: the tool can only reach `service.getState({ window })`,
which projects a window without persisting it — asking for `7d` does not change the
widget's selection, and the credential-writing `setConfig()` is not reachable from it
at all. Tool output is English (it is a model interface, not UI copy) while the panel
stays bilingual.

`defineTool()` lives in `@deepseek-ai/dsh-tools`, which a zero-dependency package — and
this profile — cannot resolve, so the definition is hand-built from what a raw
registration is consumed for (`name`, `description`, a full JSON-Schema `parameters`,
`output.schema`/`output.render`, `execute`). Registration runs inside a try/catch with an
activation self-check: if the definition no longer satisfies the runtime (registration
throws) or no longer reaches the model-facing projection (`tools.schemas()` omits it), the
tool withdraws itself and logs why — it can never break the widget or prompt assembly.
Verified on an isolated instance: `read-only agent tool deepseek_balance ready
(visible=true, projected=true)`. A live model turn invoking it is the one step that needs
an agent session (and therefore a provider credential), so it is not covered by the
automated checks.

## Notes

- `/usage/cost` and `/usage/amount` are **private** platform-dashboard endpoints
  (not in the public docs) and may change; the plugin degrades to estimates
  automatically. Usage figures are **account-wide** — the platform API does not
  filter by API key.
- A `userToken` expires naturally; usage may lag by up to 1 hour (memory cache);
  the 刷新 button clears it.
- Keys are stored unencrypted in `~/.deepseek-balance.json` (0600) — never share it.
- The state file carries a `schemaVersion` envelope and is written **atomically**
  (temp file + rename) with serialised writers. A corrupt or future-versioned file is
  **renamed aside** to `….corrupt-<timestamp>`, the plugin starts from empty state, and
  the panel shows why — nothing is silently discarded.
- Statutory holidays come from the **annual State Council notice** and are currently
  bundled for **2026**. After the new year the plugin must be updated to know the next
  year's holidays; an unlisted year is flagged「节假日数据待更新」and judged as plain
  Mon–Fri until then.

## Contributing

Issues and PRs welcome (peak-hour threshold alerts, per-model filtering, more locales…).
Keep `lib/client.js` in the `window.__ModuleLoader__` artifact format.

Run `npm test` (**123 cases**, zero-dependency Node assertions) after touching any module:

| Suite | Cases | Covers |
| --- | --- | --- |
| `test/phase.test.mjs` | 28 | weekday/weekend/holiday phases, merged holiday runs, unlisted-year fallback |
| `test/window.test.mjs` | 14 | Beijing midnight boundaries, snapshot estimate (top-ups excluded), multi-month/year ranges, per-model and token totals |
| `test/config.test.mjs` | 6 | defaults, wholesale-replacement semantics, unknown fields, range and https validation |
| `test/store.test.mjs` | 9 | atomic write, serialised writers, mode 0600, corrupt/foreign-file quarantine, diagnosable save failure |
| `test/i18n.test.mjs` | 5 | BCP 47 normalisation, `settings.describe()` read, safe degradation |
| `test/service.test.mjs` | 13 | poll/refresh/setConfig/setWindow/getState with an injected HTTP layer (no network) |
| `test/tool.test.mjs` | 9 | tool definition shape, read-only guarantee (no write call, no key fragment), schema-valid output, argument bounds, English render |
| `test/routes.test.mjs` | 18 | validation bounds: bad id, non-JSON, wrong type, `fromMs` range, length, key shape |
| `test/package.test.mjs` | 21 | name/exports, a single `insert` row, client artifact and copy table, non-regression of the auth gate |

CI (`.github/workflows/test.yml`) runs `npm run check` + `npm test` on a Node 20/24 matrix.
Changing the **client artifact format** (`window.__ModuleLoader__.load` + `exports.inject`),
the **auth gate**, the **state-file format**, the **tool definition** or the **phase
algorithm** means updating the matching suite; the phase algorithm and the copy table both have structural guards
(no Chinese literal outside the table, one-to-one zh/en keys).

## License

[MIT](LICENSE)
