# Permission justifications — Chrome Web Store dashboard

Paste one paragraph per permission into the justification fields of the "Privacy practices" tab.

## `storage`
Stores the user's settings (protection switches, theme, allowlist, custom blocks, WebRTC policy choice), lifetime counters (blocked requests, detected signals), and the event log (max 500 entries, domain and a short text, never full URLs). All data stays in the user's browser; nothing is synced or transmitted.

## `unlimitedStorage`
The optional wide blocklist ("threat list", off by default) requires storing tens of thousands of domains in `chrome.storage.local`. Without this permission the list could exceed the default storage quota and silently fail to load. Storage remains purely local.

## `declarativeNetRequest`
Used to block connections to known IP logger and link grabber domains without reading the request contents. Blocking happens on the browser's network stack; the extension never sees headers, bodies or cookies of blocked or allowed requests.

## `alarms`
Schedules the twice-daily automatic refresh of the built-in domain list and the hourly cleanup of tab state. No alarm is used for tracking or communication.

## `tabs`
Used to identify the active tab when judging navigations, to apply per-tab temporary allow rules (allow once in this tab), and to clean up session storage when tabs close. The extension does not read page contents, history or other tabs.

## `webNavigation`
Used to observe when the active tab begins navigating to a URL so the extension can evaluate whether the destination is on the blocklist before the request proceeds, and on blocked navigations to present the block page with the target and allow options. Only the navigation of the active tab is evaluated; the extension does not build a browsing history and does not store URLs in the event log.

## `privacy`
Used to apply an optional browser-wide WebRTC IP policy that the user explicitly selects (default: browser default, i.e. the policy is left untouched). The browser policy is never changed without the user's action, and the extension records what it changed so it can restore the default.

## Host permissions: `http://*/*` and `https://*/*`
Content scripts match only these two schemes; the extension evaluates IP-harvesting behavior on the pages the user visits so it can show in-page warnings. This scope is the same as content scripts and excludes `file://`, `chrome-extension://` and every other scheme.

Note: an earlier build requested `<all_urls>`. It was narrowed deliberately; `webNavigation` only needs the navigation URL of the active tab and content scripts only match `http`/`https`.
