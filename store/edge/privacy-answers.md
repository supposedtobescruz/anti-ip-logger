# Microsoft Edge Add-ons privacy answers - Anti IP Logger

Paste these into Partner Center, Privacy section. Accurate for version 1.3.0. Copy each block into its matching field as-is.

## Single purpose

Protects users from IP logger and link grabber links: blocks connections to known IP-harvesting domains and warns when a page behaves like it is collecting your IP address.

## Permission justifications

One per permission declared in `manifest.json` (`permissions` and `host_permissions`).

### storage

Stores the user's settings (protection switches, theme, allowlist, custom blocks, WebRTC policy choice), lifetime counters (blocked requests, detected signals), and the event log (max 500 entries, domain and a short text, never full URLs). All data stays in the user's browser on their device; nothing is synced, transmitted or shared.

### unlimitedStorage

The optional wide blocklist ("threat list", off by default) requires storing tens of thousands of domains in `chrome.storage.local`. Without this permission the list could exceed the default storage quota and silently fail to load. Storage remains purely local.

### declarativeNetRequest

Used to block connections to known IP logger and link grabber domains without reading the request contents. Blocking happens on the browser's network stack; the extension never sees headers, bodies or cookies of blocked or allowed requests.

### alarms

Schedules the twice-daily automatic refresh of the built-in domain list and the hourly cleanup of tab state. No alarm is used for tracking or communication.

### tabs

Used to identify the active tab when judging navigations, to apply per-tab temporary allow rules (allow once in this tab), and to clean up session storage when tabs close. The extension does not read page contents, history or other tabs.

### webNavigation

Used to observe when the active tab begins navigating to a URL so the extension can evaluate whether the destination is on the blocklist before the request proceeds, and on blocked navigations to present the block page with the target and allow options. Only the navigation of the active tab is evaluated; the extension does not build a browsing history and does not store URLs in the event log.

### privacy

Used to apply an optional browser-wide WebRTC IP policy that the user explicitly selects (default: browser default, i.e. the policy is left untouched). The browser policy is never changed without the user's action, and the extension records what it changed so it can restore the default.

### Host permissions: `http://*/*` and `https://*/*`

Content scripts match only these two schemes; the extension evaluates IP-harvesting behavior on the pages the user visits so it can show in-page warnings. This scope is the same as content scripts and excludes `file://`, `chrome-extension://` and every other scheme. These permissions are also required so declarativeNetRequest block rules apply to requests on the pages the user visits and webNavigation can judge the navigation before it proceeds.

## Remote code

No. The extension executes no remote code. All JavaScript ships inside the package. The only network requests are the list refresh (HTTPS, to the list source URLs declared in the package, at most every six hours and on demand) and a daily version check (a single version string from a public gist, with no identifiers, no payload and no query data). No other requests are made. There is no remote configuration, no `eval` of fetched text and no dynamic script loading.

## Data usage

Collect: nothing.

- The extension has no accounts, no analytics, no telemetry, no crash reporting and no remote logging.
- None of the data types in the Partner Center data usage checkboxes are collected, and no checkbox should be ticked.
- Settings, counters and the event log (max 500 entries, domain and a short text, never full URLs) live in `chrome.storage.local` on the user's device. The URL of a blocked navigation (including its query string) is held in `chrome.storage.session`, is used only to show the block page and offer "allow once in this tab", and is cleared when the browser closes.
- Storing data locally on the user's own device with `chrome.storage` is not data collection: collection means data leaving the device to the developer or to any third party. Nothing is transmitted, and the developer operates no server that receives user data.
- The extension does not read or store browsing history, form data, cookies or keystrokes.

## Privacy policy URL

https://supposedtobescruz.github.io/anti-ip-logger/privacy.html

Served by GitHub Pages from the `docs` directory (`docs/privacy.html`) of the repository.
