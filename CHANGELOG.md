# Changelog

Notable changes to **dsh-deepseek-balance**. The package is deliberately not
published to npm — a git tag is the release, and installation happens through the
harness plugin manager or a local checkout (see the README).

## 0.2.0 — 2026-09-30

Security, structure and usability pass driven by an architecture review of the
0.1.x code. Verified on deepseek-harness 0.2.0-rc.2 (web and desktop profiles).

### Security

- **Every `/dsbal/*` route now passes the host's own request gate**
  (`ctx.connection.admit()`): the same Host/Origin trust fence and browser-cookie
  authentication the `/api` channel uses. Unauthenticated reads answer `401`,
  cross-site requests `403`, a wrong method `405`, and a malformed body `400`
  without touching any state. In 0.1.x the routes were registered bare on the web
  server, so anything that could reach the port could read account data **and
  replace the stored API key** with a cross-site "simple" POST.
- Credential writes remain user-only: the new agent tool can only *project* state
  through `getState()`, so `setConfig()` is unreachable from a model by
  construction rather than by policy.
- Input bounds: `fromMs` may not be in the future nor older than 90 days (an
  unbounded value could drive up to 24 upstream usage requests per call),
  credential fields are length-capped, and an API key is shape-checked (`sk-…`)
  when the user saves one — never for values already in the state file.

### Added

- **`config:` support** — `pollIntervalMs`, `historyDays`, `usageTtlMs`,
  `usageErrorTtlMs`, `maxSnapshots`, `requestTimeoutMs` and the three endpoint URLs
  are validated at activation and overridable from the profile patch. An invalid
  value fails loudly, naming the field.
- **Bilingual widget** — ~70 user-visible strings moved into a zh/en table; the
  language follows the host's settings preference, else the browser's, with an
  explicit choice in the panel (remembered locally). Statutory-holiday and pricing
  copy is phrased client-side from structured phase facts.
- **Plugin metadata** — `icon.svg`, `locale/zh.json`, `locale/en.json` and the
  matching manifest fields, so the plugin manager card has a title, a description
  and artwork instead of falling back to the package name.
- **Read-only agent tool `deepseek_balance`** — reports the price phase, balance,
  period spend and token counters; `window` (and `fromMs` for `custom`) projects a
  period *without* persisting it. Registered through an optional injection and
  guarded: if the runtime ever stops accepting the definition, or the model-facing
  schema projection drops it, the tool withdraws itself and logs why.
- **`storageError` in the state payload**, reported separately from upstream API
  failures so the panel can distinguish "the local file is unusable" from "the
  platform API failed".

### Changed

- The host half is now an assembly layer over focused modules — `lib/phase.js`
  (pricing phases + holiday calendar), `lib/window.js` (range, snapshot estimate,
  monthly aggregation), `lib/deepseek.js` (HTTP client + parsing), `lib/validate.js`,
  `lib/config.js`, `lib/store.js`, `lib/i18n.js`, `lib/service.js`, `lib/tool.js`.
  `lib/index.js` went from 648 to 154 lines.
- The test suites import the real modules; they no longer slice source text out of
  `lib/index.js`, so refactors stop failing on "source shape" assertions.
- The state file carries a `schemaVersion` envelope and is written atomically
  (temp file + rename) by a serialised writer; 0.1.x files load unchanged and are
  upgraded in place.
- The panel polls at the host-reported `pollIntervalMs` instead of a hard-coded
  30 s, pauses while the tab is hidden, and derives the countdown from a local
  clock offset-corrected against the host.

### Fixed

- A corrupt or future-versioned state file is **quarantined** as
  `….corrupt-<timestamp>` and reported, instead of being silently overwritten by
  the first poll (which also made the old "fresh state" path look like data loss).
- The panel header no longer wraps in English: the key mask and the language
  choice moved into the settings block, and the header can no longer wrap.
- The token card no longer claims "add a userToken" when the period's total is
  simply `0` (which is what "today" reads just past Beijing midnight); a failing
  usage endpoint now reports its error instead.

### Tests

- 42 → **123 cases** in 9 suites (phase, window, config, store, i18n, service,
  tool, routes, package), all dependency-free Node assertions; CI runs
  `npm run check && npm test` on a Node 20/24 matrix.

## 0.1.0 — 2026-08-22 … 2026-09-29

Initial plugin: total/topped-up balance from the official endpoint, period spend
with a per-model split and the three token counters from the platform's private
usage endpoints (account-wide, with a balance-snapshot estimate as fallback), the
peak/off-peak (梁文峰 / 梁文谷) price reminder with Chinese statutory holidays, and a
draggable bottom-right widget. Along the way: strict `/dsbal/*` request validation,
a GitHub Actions test workflow, and the `dsh.bundle` declaration that lets the
plugin manager install the package as a profile layer.
