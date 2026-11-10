# Chrome Web Store listing - English

## Title
Anti IP Logger

## Short description (132 characters max)
Blocks IP logger and link grabber domains before they open. No data collection, no telemetry, English and Turkish.

(Character count: 118.)

## Category
Tools

## Tags (optional, honest)
privacy, security, ip logger, grabify, link grabber, discord safety

## Single purpose (required field)
Protects users from IP logger and link grabber links: blocks connections to known IP-harvesting domains and warns when a page behaves like it is collecting your IP address.

## Detailed description

Anti IP Logger blocks the links that exist to harvest your IP address: Grabify, IPLogger and similar services distributed through Discord, WhatsApp, Telegram and anywhere else.

What it does

- Blocks connections to a curated list of known IP logger and link grabber domains, before the request reaches the network.
- Ships a built-in list (125 domains, verified against public sources, refreshed automatically from upstream sources when they change).
- Warns you in-page when a site attempts behaviors associated with IP collection: WebRTC candidate dumps, click-less form submits, hidden iframes and tracking pixels, meta refresh redirects, and third-party requests before any interaction.
- Shows a full-page notice when a navigation is blocked, with the target address, the source confidence, and allow options.
- Keeps a local event log and counters in the browser. Nothing is sent anywhere.

What it does not do

- It is not a VPN and does not hide your IP address.
- It is not a network-wide filter. It only affects this browser.
- It does not collect, store or transmit any personal data. There is no telemetry, no analytics, no crash reporting.
- It does not block ads. The built-in list targets IP harvesting domains only.

About the list

- 125 domains, 91 confirmed by multiple sources, 34 from single sources.
- Sources and licenses are listed in `THIRD-PARTY-LICENSES.md` (TMAFE list, MPL-2.0; PhishIndex, MIT; DeGrabify, attribution given).
- The list refreshes at most every six hours and on demand; failed refreshes never wipe the previous list.

Languages

- Full English and Turkish interface. The browser UI language is respected automatically, or you can force one from Settings.
- Opens a six-step welcome tour on first install, with Scruize, an on-brand goth mascot. Replay it from Settings → About any time.

Privacy and permissions

- Everything runs locally. Settings, counters and the event log (max 500 entries, domain + short text, never full URLs) live in your browser.
- No data ever leaves your machine. See the privacy policy for details.

If the extension blocks something you need, you can allow it once for the tab, allow the site, or remove it from the list. All of this is managed from the panel.

## Notes for the reviewer

- Broad host permissions are required for `webNavigation` (to judge the navigation being blocked) and for content scripts, which match `http://*/*` and `https://*/*` only.
- The extension never executes remote code.
- The WebRTC policy setting is optional and off by default ("Browser default").
