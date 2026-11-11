# Submission notes - Microsoft Edge Add-ons - Anti IP Logger

Checklist and certification tester notes. The package is not submitted; nothing in this file means it was submitted.

## Checklist

- [ ] `npm run verify:all` passes.
- [ ] `npm run package` produces the upload package (`dist/anti-ip-logger-1.3.0-cws.zip`).
- [ ] Listing text taken from `store/edge/listing-en.md` (English) and `store/edge/listing-tr.md` (Turkish).
- [ ] Privacy answers taken from `store/edge/privacy-answers.md`, including the privacy policy URL.
- [ ] Assets per `store/edge/assets.md` (logo, screenshots EN/TR, promo tiles).
- [ ] Category: Tools. Search terms as listed.
- [ ] Privacy policy URL is public and matches the shipped extension before submission.

## Certification tester notes

- No account required. There is no sign-up, login, license key or API token. Every feature works immediately after install.
- The WebRTC IP policy setting is optional and off by default ("Browser default"). The browser-wide WebRTC policy is never changed until the user explicitly picks an option in Settings, and the extension restores the default only for the change it applied.
- The broad host permissions (`http://*/*` and `https://*/*`) exist so declarativeNetRequest block rules apply to requests on the pages the user visits and so webNavigation can judge the active tab's navigation before the request proceeds. Content scripts match only these two schemes. There is no access to `file://`, `chrome-extension://` or any other scheme.
- To trigger the blocked page safely, navigate to `https://grabify.link/test-verify` in the address bar. grabify.link is a real IP logger service. The navigation is blocked by the extension before the request reaches the network, so no personal data is sent and nothing is logged on grabify.link's side. Do not create a Grabify link, do not share one, and do not type personal data into the page or into any IP logger link. Do not submit any personal data during testing. The blocked page opens with the target address, the source confidence and allow options.
- If the reviewer prefers not to visit grabify.link at all, enabling Settings → Data → export shows the local-only event log, and the same block behavior is covered by the automated browser check (`tools/verify-browser.mjs` loads the test path and asserts the redirect to the block page).
- The interface is English (default) and Turkish. The browser UI language is respected automatically, and the language can be forced in Settings.
- The extension makes no network request except the list refresh (HTTPS, fixed source URLs, at most every six hours and on demand from Settings) and a daily version check (a single version string from a public gist, no identifiers).
- The event log holds at most 500 entries (domain + short text, never full URLs) in `chrome.storage.local`. Export, reset and clear are all under Settings → Data.
- The extension is not a VPN and does not hide the user's IP address. The listing and the policy both say so.
