# Anti IP Logger - Privacy Policy

Last updated: 2026-11-10. Version covered: 1.1.0.

## What this extension does

Anti IP Logger blocks connections to known IP logger and link grabber domains, shows a warning when a page shows behaviors associated with IP address collection, and keeps a local event log. It is not a VPN, it does not hide your IP address, and it is not a network filter for your whole device.

## Data collection

None. The extension has no accounts, no analytics, no telemetry, no crash reporting and no remote logging. Nothing you do with it is sent anywhere by the extension itself.

## Network requests

The extension makes network requests only to refresh the built-in domain list. These requests go exclusively to the list source URLs published in the source tree (`data/sources.json`), over HTTPS, at most every six hours and when you press a refresh button. No other network requests are made. There are no cookies and no fingerprinting.

## What is stored, and where

Everything stays on your device.

- `chrome.storage.local`: settings (protection switches, theme, allowlist, custom blocks, WebRTC policy choice), lifetime counters, the event log (at most 500 entries, each with a domain and a short description, never a full URL) and a cache of the remotely refreshed list.
- `chrome.storage.session`: per-tab state (host, score signals, banner state) and the URL of a blocked navigation, including its query string. The blocked page uses this to offer "allow once in this tab and open". Session storage is cleared when the browser closes.
- The extension does not read or store your browsing history, your form data, your cookies or your keystrokes.

## WebRTC policy

If you change the WebRTC IP policy in the settings, that change is applied browser-wide and stays in place even if you uninstall the extension. To restore your browser default before removing the extension, select "Browser default" first, then uninstall.

## Permissions

See `store/permission-justifications.md` for the exact text used for each permission declaration. In short: the extension needs storage for settings and counters, declarativeNetRequest to block requests without reading them, tabs and webNavigation to judge the active tab's navigation, alarms for list refresh, and an optional browser-wide WebRTC policy via the privacy API.

## Your choices

You can clear the event log and export or reset all data at any time from the panel (Settings → Data). Uninstalling removes the extension's code; the event log and settings are deleted with it. As noted above, the WebRTC policy is the one setting that can persist beyond uninstall.

## Children

The extension is not directed at children and collects no data from anyone.

## Changes

If this policy changes, it changes in this file and the date above changes with it.

## Contact

Questions: open an issue in the project repository (`supposedtobescruz/anti-ip-logger`).

---

# Anti IP Logger - Gizlilik Politikası (Türkçe özet)

Son güncelleme: 2026-11-10. Kapsanan sürüm: 1.1.0.

Anti IP Logger hiçbir kişisel veri toplamaz. Hesap, analitik, telemetri veya uzaktan kayıt yoktur. Uzantı yalnızca liste kaynakları (`data/sources.json`) HTTPS üzerinden liste tazelemek için ağ isteği yapar; başka ağ isteği yapmaz. Ayarlar, sayaçlar ve en fazla 500 kayıtlık olay kaydı (alan adı + kısa açıklama, asla tam URL yok) `chrome.storage.local` içinde kalır. Engellenen bir gezinmenin tam URL'si (sorgu dizesi dahil) sekme durumu olarak `chrome.storage.session` içinde tutulur ve tarayıcı kapanınca silinir; engel sayfası bunu "Bu sekmede izin ver ve aç" için kullanır. WebRTC politikasını değiştirirseniz bu değişiklik uzantı kaldırıldıktan sonra da yerinde kalabilir; önce "Tarayıcı varsayılanı"nı seçin, sonra kaldırın. Dilediğinizde panelden (Ayarlar → Veri) olay kaydını temizleyebilir, yedek alıp her şeyi sıfırlayabilirsiniz.
