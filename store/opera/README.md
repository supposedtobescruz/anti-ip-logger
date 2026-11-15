# Opera Add-ons kit - Anti IP Logger

Everything needed for an Opera Add-ons submission. The kit is prepared but not submitted; nothing in this file means it was submitted. Opera Add-ons (addons.opera.com) publishing is free, but submission is manual through the Opera developer dashboard.

## What is in this folder

- `listing-en.md` - English listing text: title, short description, detailed description, single-purpose statement, category (Privacy & Security), tags, reviewer notes.
- `listing-tr.md` - Turkish counterpart of the same listing, section for section.
- `submission-notes.md` - checklist, reviewer notes, per-permission rationale paragraphs (Opera has a single notes field), and a safe way for a reviewer to trigger the block page.
- `screenshots/` - six 612x408 store screenshots (English UI): overview, lists, blocked page, popup, dark theme, settings. Made from `verify-output/` captures of a real build.
- `verify-opera-140.0.6074.18.json` - committed evidence snapshot of the Opera run: `node tools/verify-browser.mjs --browser opera --out verify-output/opera`, 49/49 browser checks passed on 2026-11-15 (Windows). The live `verify-output/` tree is gitignored, so this copy is the durable record.
- `../../PRIVACY.md` and `../../docs/privacy.html` - the privacy policy, in text and in a standalone page.

## Requirements checklist (Opera Add-ons)

- [x] Manifest V3, single purpose declared in listing.
- [x] No remote code execution; the only network requests go to the list sources and a daily version check.
- [x] Privacy policy ready and served at https://supposedtobescruz.github.io/anti-ip-logger/privacy.html
- [x] Permission rationale ready (`submission-notes.md`).
- [x] Screenshots 612x408, non-interlaced, under the 800x600 maximum. Only the popup shot is composited on a white canvas; the other five are full-bleed UI captures at native aspect with no device frame.
- [x] Icons 16/32/48/128 embedded and manifest-declared.
- [x] No em dash, no fabricated stats, no fake assets; copy is honest about scope ("not a VPN").
- [x] `npm run package` produces `dist/anti-ip-logger-1.5.0-cws.zip` with runtime files only (62 runtime files, SHA256 569d07e492a8a5097857f559d68752413c19ddd9febddd4290d736067b0ab707).
- [x] Opera run of the browser suite: 49/49 passed on Opera Stable 140.0.6074.18 (Windows, 2026-11-15). Evidence: `verify-opera-140.0.6074.18.json`.
- [ ] Opera account. Creating one is free. Nothing is submitted by this repository.

## Opera verification run (2026-11-15)

- Command: `node tools/verify-browser.mjs --browser opera --out verify-output/opera`
- Result: 49/49 browser checks passed, exit 0.
- Browser: Opera Stable 140.0.6074.18. Its bundled Chromium build reports `Chrome/157.0.8103.39` over CDP, so the captured `report.json` records product `Chrome/157.0.8103.39` and version `157.0.8103.39`.
- Windows only. macOS and Linux were NOT tested, and Opera reviewers test on Windows, macOS and Linux. Say so when submitting.
- Opera was installed only to run this check and was removed afterwards. Re-running the Opera check needs a fresh Opera install, then the command above again.
- The listing is prepared, not submitted.

## Manual submission steps, in order

1. Create an Opera account at addons.opera.com if you do not have one.
2. Open the Opera Add-ons developer dashboard on addons.opera.com (sign in, then the developer section).
3. Choose to add a new extension and upload `dist/anti-ip-logger-1.5.0-cws.zip` (built by `npm run package`).
4. Paste the listing text from `listing-en.md` into the English fields and `listing-tr.md` into the Turkish localization. Set category to Privacy & Security.
5. Upload the six screenshots from `screenshots/` (612x408, under the 800x600 maximum). Opera prefers a white background; only the popup shot is composited, the other five are full-bleed UI captures.
6. Set the privacy policy URL to https://supposedtobescruz.github.io/anti-ip-logger/privacy.html
7. Paste the permission rationale and reviewer notes from `submission-notes.md` into the notes field.
8. Submit for moderation. Expect a moderation delay; there is no published SLA. If reviewers ask questions, `submission-notes.md` answers them.

## What cannot be automated, and why

- Uploading the package: Opera has no public submission API. The Edge Add-ons workflow exists only because the Edge Add-ons Update REST API exists; there is no Opera equivalent, so every submission is manual through the dashboard.
- Listing metadata: description, logo, screenshots, search terms all stay in the dashboard by hand, same as on Edge and Chrome Web Store.
- Skipping moderation: a submitted extension still goes through Opera moderation before going live. Nothing in this kit bypasses review.
- Opera smoke testing: done on Windows only. Opera Stable 140.0.6074.18 passed 49/49 browser checks on 2026-11-15 (evidence: `verify-opera-140.0.6074.18.json`); macOS and Linux were NOT tested. Opera was installed only for that run and removed afterwards, so a re-run needs a fresh install. Do not claim macOS or Linux verification; ask the reviewer to note that Opera 97 (Chromium 111) is the floor.

## Regenerating screenshots

```powershell
node tools/verify-browser.mjs            # EN captures into verify-output/ using the first detected browser
python tools/make-store-assets.py opera store/opera/screenshots
```

`make-store-assets.py opera` writes the six 612x408 PNGs, then reopens each file and asserts size, mode and interlace. Any failure stops with a clear message. The `shots` and `promo` modes are unaffected.

## Version note

`manifest.json` is 1.5.0. Opera accepts a version with 1 to 4 integer components, which 1.5.0 satisfies. Do not add `minimum_opera_version` to the manifest; the Opera 97 floor (Chromium 111, matching `minimum_chrome_version: 111`) is documented in the listing text instead. Bump the manifest and the tag before any new submission.
