# Changelog

All notable changes to Anti IP Logger are documented here.
The format follows Keep a Changelog (https://keepachangelog.com/).
Versions follow SemVer. The project starts at 1.0.0 and has no earlier history to report.
Releases are tagged `v<version>` in git; the dates below are the tag dates.
The extension has no telemetry. Settings, counters and the event log stay in `chrome.storage.local`. See PRIVACY.md.

## [1.6.0] - 2026-11-16

### Added

- The browser suite captures the welcome tour, so all four surfaces now have a screenshot check. The matrix is 49 checks per browser.
- Shared helpers `.btn--block`, `.section-head` and `.card__meta`, plus spacing and type tokens, in `assets/base.css` for the surfaces to reuse.
- The GitHub Actions verify workflow installs Google Chrome stable and runs the suite against it explicitly, instead of relying on the preinstalled runner browser.

### Changed

- Reworked the panel, popup, blocked page and welcome tour around one instrument language: a 4px state spine, numbered mono labels, larger status lines, hairline rules, flat cards with sunken headers and square geometry. No i18n key, element id or behavior changed.
- Panel: a sunken 248px rail with numbered links and a sticky topbar, a four cell metric strip, a two column overview, a compact list toolbar, an event log with a tone dot and a mono type label per row in place of a badge, and settings split into hairline rows. The rail becomes a horizontal bar at 980px, the layout turns single column at 760px and rows tighten at 560px.
- Popup: a 30px header, a hero verdict with a state spine and a two column action grid, a four cell counter band, a compact event ticker and a footer status line.
- Blocked page: an evidence sheet with a case header, a rotated stamp, a target block with an ink spine, numbered notes and dotted fineprint.
- Welcome tour: a 320px mascot column, a bubble with an accent spine and a desktop speech tail, a six segment progress bar and a centered stage.
- Buttons, inputs and selects share a 36px control height, cards stay flat, and tables, switches, notices and the toast use the token scale.
- The panel column centers when the viewport is wider than 1428px, and toasts keep clear of the mascot corner.

### Fixed

- CI failed at the "service worker API context" step. The suite connected to a service worker and waited 10s for `Runtime.enable`; on a slow Linux runner the cold worker missed that window. `connect` now retries `Runtime.enable` and `Page.enable` for up to 10s each instead of failing on one rejection.
- The popup host check could be skipped when reloading the popup tab made it the active tab before it read the active tab state. The suite now reloads while the site tab is active, retries up to three times and always asserts the host, so the matrix stays at 49 checks.
- The CI browser check now selects Chrome explicitly (`--browser chrome`). The suite previously picked whatever Chromium browser `detectBrowsers` found first, which on ubuntu-latest could be an older preinstalled Chrome; the workflow now installs current Chrome stable and runs that binary.
- The extension popup opened as a 28px wide strip in a headed browser. The body width used `min(384px, 100vw)`, and inside a popup the initial layout viewport is 28px, so the whole popup shrank to that. The body now has a fixed 384px width, and `tools/verify-ui.mjs` checks for it.
- The popup theme action rendered the sun as a color emoji on Windows. It now uses the text variation selector, so both theme marks stay monochrome.

## [1.5.0] - 2026-11-15

### Added

- The `graphite` neutral dark theme and the `contrast` high contrast light theme, selectable from Settings. The theme list is centralized in `lib/constants.js` and reused by the settings API, storage normalization and backup import.
- A palette block per theme with WCAG AA pairs; `tools/verify-ui.mjs` checks each pair.
- Theme checks on the dashboard, the blocked page and the welcome tour in `tools/verify-browser.mjs` (45 to 49 checks per browser).
- The dashboard and popup theme action now reports the current mode, so it works from every theme.
- Unit tests for store normalization and backup import of both new themes.

### Changed

- The quick theme action switches between light and dark modes and leaves the stored theme as an explicit choice. The browser matrix is 49 checks per browser.

### Fixed

- The blocked page and the welcome tour ignored the stored theme and only followed the operating system preference, so an explicit light, graphite or contrast choice was lost on those pages. They now load the stored theme.

## [1.4.1] - 2026-11-12

### Added

- Chromium family support. One Manifest V3 package covers Chrome, Edge, Brave, Opera, Opera GX, Vivaldi, Yandex Browser and Chromium, with Chromium 111 as the floor for `world: MAIN` content scripts. README, readmeTR and the store notes list the per-browser install pages and what has actually been run.
- `tools/browser-paths.mjs` detects the supported browsers on Windows, macOS and Linux. `npm run verify:browser` gains `--browser <id|name|path>`, `--list` and `--out`, keeps `BROWSER_PATH` and the legacy `BRAVE_PATH`, and records the browser name and version in `report.json`.
- `npm run verify:browsers` runs the browser suite in every detected browser, writes each run to `verify-output/<browser>/` and a summary matrix to `verify-output/browsers.json`. Verified on Edge 157 and Brave 157, 45 checks each.
- Tab allows are applied as session-scoped DNR rules, the only scope Chromium accepts for `tabIds`, and the dynamic rule budget reserves room for them.

### Changed

- Backup export carries settings only. It previously wrote `stats` and `events` that the importer never restored, so the file promised a restore it could not perform.
- Clearing the event log asks for confirmation before the 500 entry history is deleted.
- The popup body is `min(384px, 100vw)`, so 200% zoom and narrow windows do not hide the right-side controls.
- The overview "Update list" action reports progress and result in a visible status line instead of the hidden node in Sources.
- The store package stops shipping `readme/`, `CONTRIBUTING.md`, `data/curated.json` and `data/exceptions.json`. `verify:package` builds in a temporary directory, rejects zip files for other versions in `dist/`, checks the archive allowlist, and the same input produces a byte-identical zip.
- Adds 34 node:test cases, 136 in total, including DNR session rules, import validation, the privileged message set and browser detection.

### Fixed

- The Core tier is the single source of truth for packaged domains. With the tier off, `classifyHost`, the popup, the dashboard and the tab icon now report the truth instead of a block that never happens.
- Backup import validates every settings field with the same rules as the settings API instead of coercing values, so `enabled: 0` or `tiers: { core: "false" }` can no longer flip enforcement.
- Custom-blocked domains no longer generate a blocked-page redirect rule that the higher-priority block rule always wins, which frees dynamic rule budget.
- Pause expiry is checked on navigation, so a late or missed pause-end alarm no longer leaves enforcement off while the interface says protection is on.
- The welcome tour no longer intercepts Enter, which broke keyboard activation of Back and Skip.
- Background storage changes no longer blank the popup to a skeleton or drop focus, and the dashboard restores focus after a list re-render.
- Programmatically focused containers keep a visible focus ring.
- `openDashboard` is privileged like the other extension-page messages, and `reportBlock` ignores subframe senders.
- Dashboard aria labels for the section nav, the protection toggle and the backup file input are translated.
- The blocked page note states that the allowlist takes precedence. It previously claimed the domain is removed from the blocklist.
- Turkish warning badge reads `şüpheli`, and the pause, clear-log and import copy matches the actual behavior in both locales.

### Removed

- The `disable_udp` WebRTC policy option. It is not a valid Chromium `webRTCIPHandlingPolicy` value, so choosing it always failed and reverted. `default` and `disable_non_proxied_udp` remain.
- The dead `declarativeNetRequest.onRuleMatchedDebug` handler, which needs an unpacked-only permission and never ran in a packaged build.

## [1.4.0] - 2026-11-12

### Added

- Temporary protection pause. The Settings card and the popup can stop blocking and in-page warnings for 15 or 60 minutes and resume at any time. A pause-end alarm restores protection automatically, the popup and panel show the paused verdict with the end time, and the dynamic rules and the static ruleset are removed while the pause lasts.
- Pausing leaves the allowlist, custom blocks, counters, event log and WebRTC policy untouched. A backup restore ends any active pause instead of restoring it.
- `lib/protection.js` holds the pause helpers and the two allowed durations. Adds nine node:test cases for state transitions and duration validation, a paused-verdict case, and eight browser checks that verify rules are removed and restored.

## [1.3.0] - 2026-11-11

### Added

- Dashboard language switch applies immediately without a reload. The language select reinitializes the locale, reapplies the static translations, rerenders the route and reloads the data. The category filter options are rebuilt when the language or the visible categories change, so their labels no longer stay in the old locale (55f25d1).
- The welcome tour takes the total step count from its own constant instead of a hardcoded 6 in both messages (55f25d1).
- `tests/store.test.mjs` covers the store layer with fifteen node:test cases against an in-memory chrome.storage fake: settings defaults and partial merges, list normalization with dedupe and cap, event clamping and retention, clearing events, resetAll and tab state round trip plus stale pruning (2beba10).
- This changelog documents the released history in Keep a Changelog format (9f50d8a).
- Backup restore can replace or merge the allowlist and custom blocklist. The background applies the union; the dashboard preview is not trusted. The summary shows the mode, the resulting list counts, the WebRTC policy and the backup version when it is a valid x.y.z string. A backup language is restored only when it is system, en or tr. Stats and events stay untouched (5d85908).
- `lib/backup.js` holds restore normalization and merge; `lib/privilege.js` holds the privileged message set and the extension-page sender check. Adds 30 node:test cases covering mode validation, list normalization, caps, replace and merge semantics, every privileged message name and lookalike sender URLs (212816f).
- `tools/check-i18n.mjs` compares locale key sets, placeholders, empty strings and the committed fallback modules against the generator. A locale edit without regeneration now fails verify:all (3648794).
- `tools/verify-package.mjs` rebuilds the store zip, parses its central directory and checks every manifest-declared path is inside and no test, tool, docs directory, store or changelog file leaked in. CI runs it after the static checks (3648794).

### Changed

- Content scripts are injected into the top frame only. Both scripts already returned in subframes; network blocking still applies to every frame (ee7363e).

### Fixed

- The WebRTC policy is re-applied when the browser value drifted from the recorded marker. The background now reads the real value, skips only when marker and browser agree, and clears only a policy the extension recorded (ee7363e).

## [1.2.2] - 2026-11-11

### Fixed

- WebRTC policy failures from backup imports and background applies are now reported. The import result carries a warning and the dashboard shows it. A failed background apply writes a single error event per policy until an apply succeeds; the event log has an Error type, tone and filter entry (be0c039).

## [1.2.1] - 2026-11-11

### Added

- Backup restore asks for confirmation. The dashboard reads at most 1 MB, validates the file, shows a summary of what the backup changes and waits for an explicit confirm; cancel keeps the current settings (dbc3ff7).

### Changed

- A workflow syncing the update-check gist on tagged releases was added and then reverted; it was dropped pending a token with gist scope (6a3381a, df1b40e).

### Fixed

- The protection toggle no longer reports success when the write failed. The remote coverage tile reports the tier as off instead of a count that is not applied. A sync that adds nothing says the list is up to date (dbc3ff7).
- A rejected WebRTC policy rolls back and tells the user. A reset that cannot restore the browser-wide policy stops before wiping the only marker for it (dbc3ff7).
- Content scripts run only in the top frame; a forged subframe cannot steer the banner. The guard retries after protection is re-enabled instead of latching off. It stores only the host of a hidden pixel or iframe, never the full URL. Settings lists are capped, event hosts and details are clamped, and the version check reads a size-limited body and validates the version string before comparing (74c28a8).
- Core-tier blocks and redirects now honor the core toggle in both paths. Block rules are reserved before redirect chunks so a full rule budget cannot leave domains unblocked. Redirect ids are offset so the two redirect groups cannot collide (debf694).

### Removed

- The unused `total` field from the sync result (fe96b54).

## [1.2.0] - 2026-11-10

### Added

- Dismissible dashboard notice when a newer version is published. The check reads a public gist version.json on the sync alarm and on startup (abec0c8).
- Toolbar icon changes tone per tab verdict: idle gray, warning amber, blocked vermilion (abec0c8).
- Blocked page gains a Copy address button. The popup gains a footer replay-tour button, an empty-state mascot, and shows the panel link for events (abec0c8).
- CI workflow runs verify:all and the browser check on Chrome via xvfb and uploads verify-output as an artifact. CONTRIBUTING.md, issue and PR templates added (abec0c8).
- Privacy docs now disclose the daily version check (c88e0a6).

### Fixed

- CI: the test glob is node-version agnostic; explicit test file names are passed to node --test; CI runs on node 24 (global WebSocket); browser verification runs on Brave, with Brave preferred on Linux path detection (4600152, 3f405b2, b0abf88, dd34f48, b380197).

## [1.1.0] - 2026-11-10

### Added

- Six-step onboarding wizard with Scruize, shown on fresh installs. Covers blocking, the block page, the banner, the popup, the panel and local-only privacy. Arrow-key navigation, Skip, polite live announcements, EN/TR. Sets `settings.onboardingSeen`; replayable from Settings -> About (5a4d32c).
- UI language selection (Same as browser, English, Turkish) as a real setting. `assets/i18n.js` supports a runtime override via `chrome.storage.local` `settings.language`, with embedded EN and TR message maps generated from `_locales` (5a4d32c).

## [1.0.0] - 2026-11-10

First tracked release. The extension was re-baselined to 1.0.0; it was never published before this version (9fd28bb).

### Added

- Manifest V3 extension: service worker, content probes, `declarativeNetRequest` blocking with an explanation page instead of the target server, popup, dashboard (overview, lists, events, sources, settings) and blocked page (506c3f2, 067b71d).
- In-page IP leak signal detection and risk scoring: WebRTC candidates, click-less form submits, hidden iframes and tracking pixels, meta refresh redirects, pre-gesture third-party requests. The warning banner requires a danger finding or two distinct warning categories (a446709, 506c3f2, 067b71d).
- Core blocklist generated from upstream sources (TMAFE, PhishIndex, DeGrabify) plus curated entries, with exceptions removed at build time. An offline build re-applies the exception filter (1baee97).
- Allowlist, custom blocklist and one-tab temporary passes (067b71d, README).
- Event log capped at 500 entries and lifetime counters (a446709).
- English UI (default) with Turkish locale support via chrome.i18n; hash routes renamed to English (#overview, #lists, #events, #sources, #settings); English fallback map for non-extension contexts, generated from `_locales` (328a12d, ac1c5ad).
- Icon generation and verification scripts; browser verification with interaction, mobile and theme coverage; unit tests for parser, domain matching, rules and risk scoring (f8124d9, ec0bbcc, 64f67cf).
- Chrome Web Store kit (English and Turkish listings, permission justifications, screenshots, promo tiles, submission checklist). Not submitted (827ca31).
- Store packaging and env-aware verification tooling; verify-browser honors `EXTENSION_PATH` and `BROWSER_LANG` (a1f0a97).
- Privacy policy (PRIVACY.md, docs/privacy.html), known-limits documentation, README rewrite in English with a Turkish translation (7890c4d, b39dc83, f0db89a, 87a192a).

### Fixed

- Dynamic rule changes applied atomically; the dynamic rule ceiling honors Chrome's 5000-rule dynamic limit instead of the 30000 static ruleset limit (7a07964).
- Blocked-page redirect limited to navigation requests; later narrowed to main_frame only (29a59f3, 8e11f9c).
- Oversized rule sets clipped within budget with allowlist > custom blocks > remote core > redirects > threat list preference; apply path hardened so a bad apply no longer poisons the on-disk cache (8e11f9c).
- Data pipeline fails loudly on bad sources; entries from the previous sync are kept on partial failure; empty parses are treated as source failures (a965873).
- Weak-signal score totals no longer escalate verdicts to danger; false positives on ad-heavy legitimate sites reduced; known ad, analytics, consent and player noise list expanded (9e89377, 1dec585).
- Service worker lifecycle, tab state and WebRTC reset hardened; clearing the log keeps lifetime counters; a full reset restores the browser WebRTC policy when the extension changed it (4142151).
- Content script hooks wrapped in try/catch; iframes covered; DOM scans debounced (6860b89).
- Popup and dashboard coalesce concurrent loads; events view no longer crashes before first load; dead controls dropped (e4c2ddc).
- Pages stable outside the extension runtime; the Theme button applies the theme before persisting it (1fbef33).
- Theme switch label syncs with the active theme; popup events shortcut points at #events; dead English fallback copy dropped from lib/risk.js (44bd1b7, 7ae3844, 767fc86).

### Security

- `host_permissions` narrowed from `<all_urls>` to `http://*/*` and `https://*/*` (e40964b).
- Privileged messages require an extension-page sender; content scripts may only touch their own tab host (8e11f9c).
