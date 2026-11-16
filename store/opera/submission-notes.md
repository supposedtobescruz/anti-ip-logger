# Submission notes - Opera Add-ons - Anti IP Logger

Checklist and reviewer notes. The package is not submitted; nothing in this file means it was submitted. Opera Add-ons publishing is free, and submission is a manual process through the Opera developer dashboard at addons.opera.com. There is no API automation for Opera, so every step below is done by hand.

## Checklist

- [ ] `npm run verify:all` passes.
- [ ] `npm run verify:package` passes and produces no store/ files inside the package.
- [ ] `npm run package` produces the upload package (`dist/anti-ip-logger-1.6.0-cws.zip`, 62 runtime files, SHA256 a217bc456f9299a34d3814dd504cb0aba7b9eb0388030d0baa5bfb396fb34b1e).
- [ ] Listing text taken from `store/opera/listing-en.md` (English) and `store/opera/listing-tr.md` (Turkish).
- [ ] Screenshots (612x408) from `store/opera/screenshots/` uploaded to the listing.
- [ ] Category: Privacy & Security. Search terms as listed in the listing files.
- [ ] Privacy policy URL is public and matches the shipped extension before submission: https://supposedtobescruz.github.io/anti-ip-logger/privacy.html
- [x] Opera evidence snapshot committed: `store/opera/verify-opera-140.0.6074.18.json` (49/49 browser checks, Opera Stable 140.0.6074.18, Windows, 2026-11-15) for the 1.5.0 build.
- [ ] Opera rerun for 1.6.0 and fresh 612x408 screenshots. The 49/49 record above and the current screenshots cover 1.5.0.
- [ ] Version in `manifest.json` is 1.6.0; Opera accepts 1 to 4 integer version components.
- [ ] Do not add `minimum_opera_version` to the manifest; the Opera 97 floor is documented in the listing text instead.

## Opera 97 floor

Opera 97 equals Chromium 111, which is the release that ships `world: MAIN` content scripts. `manifest.json` declares `minimum_chrome_version: 111` and the extension uses standard Chromium Manifest V3 APIs only. Releases older than Opera 97 lack `world: MAIN` content scripts, which the in-page warning path depends on, so 97 is the supported floor.

## Permissions rationale

Opera's dashboard has a single notes field rather than per-permission justification fields, so the per-permission paragraphs are pasted here as one block. Wording is adapted from `store/permission-justifications.md`; it is not new rationale.

- `storage`: Stores the user's settings (protection switches, theme, allowlist, custom blocks, WebRTC policy choice), lifetime counters (blocked requests, detected signals), and the event log (max 500 entries, domain and a short text, never full URLs). All data stays in the user's browser; nothing is synced or transmitted.

- `unlimitedStorage`: The optional wide blocklist ("threat list", off by default) requires storing tens of thousands of domains in `chrome.storage.local`. Without this permission the list could exceed the default storage quota and silently fail to load. Storage remains purely local.

- `declarativeNetRequest`: Used to block connections to known IP logger and link grabber domains without reading the request contents. Blocking happens on the browser's network stack; the extension never sees headers, bodies or cookies of blocked or allowed requests.

- `alarms`: Schedules the automatic refresh of the built-in domain list at most every six hours (plus on demand) and the periodic cleanup of tab state. No alarm is used for tracking or communication.

- `tabs`: Used to identify the active tab when judging navigations, to apply per-tab temporary allow rules (allow once in this tab), and to clean up session storage when tabs close. The extension does not read page contents, history or other tabs.

- `webNavigation`: Used to observe top-level navigation starts in every tab, so the extension can apply and clear per-tab allow rules and evaluate whether a destination is on the blocklist before the request proceeds. On blocked navigations it also drives the block page. The extension does not build a browsing history; the pending URL is kept only in `chrome.storage.session` until the browser closes or the navigation ends, and the event log never stores URLs.

- `privacy`: Used to apply an optional browser-wide WebRTC IP policy that the user explicitly selects (default: browser default, i.e. the policy is left untouched). The browser policy is never changed without the user's action, and the extension records what it changed so it can restore the default.

- Host permissions `http://*/*` and `https://*/*`: Content scripts match only these two schemes; the extension evaluates IP-harvesting behavior on the pages the user visits so it can show in-page warnings. This scope is the same as content scripts and excludes `file://`, `chrome-extension://` and every other scheme. These are also required so declarativeNetRequest block rules apply to requests on the pages the user visits and webNavigation can judge the navigation before it proceeds. Note: an earlier build requested `<all_urls>`; it was narrowed deliberately.

## Reviewer notes

- No account required. There is no sign-up, login, license key or API token. Every feature works immediately after install.
- The extension makes no network request except the list refresh (HTTPS, fixed source URLs, at most every six hours and on demand from Settings) and a daily version check (a single version string from a public gist, no identifiers). There is no remote code, no remote configuration, no `eval` of fetched text and no dynamic script loading.
- All data is local. Settings, counters and the event log (max 500 entries, domain + short text, never full URLs) live in `chrome.storage.local`. Tab state lives in `chrome.storage.session`. Nothing is transmitted; the developer operates no server that receives user data.
- The WebRTC IP policy setting is optional and off by default ("Browser default"). The browser-wide WebRTC policy is never changed until the user explicitly picks an option in Settings, and the extension restores the default only for the change it applied.
- Broad host permissions (`http://*/*` and `https://*/*`) exist so declarativeNetRequest block rules apply to requests on the pages the user visits and so webNavigation can judge the active tab's navigation before the request proceeds. Content scripts match only these two schemes. There is no access to `file://`, `chrome-extension://` or any other scheme.
- Temporary protection pause (15 minutes or 1 hour) and per-tab "allow once" are available from the popup and Settings; both are local state only.
- The interface is English (default) and Turkish. The browser UI language is respected automatically, and the language can be forced in Settings.
- The extension is not a VPN and does not hide the user's IP address. The listing and the policy both say so.
- The extension is not an ad blocker. The built-in list targets IP harvesting domains only.

## Triggering the block page safely

Navigate to `https://grabify.link/test-verify` in the address bar. grabify.link is a real IP logger service. The navigation is blocked by the extension before the request reaches the network, so no personal data is sent and nothing is logged on grabify.link's side. Do not create a Grabify link, do not share one, and do not type personal data into the page or into any IP logger link. Do not submit any personal data during testing. The blocked page opens with the target address, the source confidence and allow options.

If the reviewer prefers not to visit grabify.link at all, enabling Settings > Data > export shows the local-only event log, and the same block behavior is covered by the automated browser check (`tools/verify-browser.mjs` loads the test path and asserts the redirect to the block page).

## Verification status (honest)

- Windows automation ran on Edge 157, Brave 157 and Opera Stable 140.0.6074.18 (2026-11-15), 49/49 browser checks passed in each. Opera Stable 140.0.6074.18 bundles a Chromium build that reports `157.0.8103.39` over CDP, so `verify-output/opera/report.json` records product `Chrome/157.0.8103.39` and version `157.0.8103.39`. The committed evidence snapshot is `store/opera/verify-opera-140.0.6074.18.json`.
- The Opera check was run with `node tools/verify-browser.mjs --browser opera --out verify-output/opera`. Opera was installed only to run this check and was removed afterwards; re-running the Opera check needs a fresh Opera install.
- macOS and Linux were NOT tested. Opera reviewers test on Windows, macOS and Linux; state this when submitting. The extension uses standard Chromium Manifest V3 APIs only, with no platform-specific code paths.
- The listing is prepared, not submitted. Nothing in this file means it was submitted.
