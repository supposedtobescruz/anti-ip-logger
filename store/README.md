# Chrome Web Store kit - Anti IP Logger

Everything needed for a Chrome Web Store submission. The Edge Add-ons submission is done and live (1.3.0, 11 Nov 2026); the Chrome Web Store listing itself is deliberately on hold until you decide to submit.

## What is in this folder

- `listing-en.md` - English listing text: title, short description, detailed description, single-purpose statement, category, tags.
- `listing-tr.md` - Turkish counterpart of the same listing.
- `permission-justifications.md` - one paragraph per permission, ready to paste into the dashboard's justification fields.
- `screenshots/` - six 1280×800 store screenshots (English UI), made from real builds of the published version.
- `screenshots-tr/` - the same six screenshots with the Turkish UI.
- `promo-440x280.png` - small promotional tile.
- `marquee-1400x560.png` - marquee promotional tile.
- `../PRIVACY.md` and `../docs/privacy.html` - the privacy policy, in text and in a standalone page.

## Requirements checklist (Chrome Web Store)

- [x] Manifest V3, single purpose declared in listing.
- [x] No remote code execution; the only network requests go to the list sources.
- [x] Privacy policy text ready (`PRIVACY.md`). It is served publicly at https://supposedtobescruz.github.io/anti-ip-logger/privacy.html (repository is public, GitHub Pages from `docs/`).
- [x] Permission justifications ready (`permission-justifications.md`).
- [x] Screenshots 1280×800 (6× EN, 6× TR) and promotional tiles 440×280 / 1400×560.
- [x] Icons 16/32/48/128 embedded and manifest-declared.
- [x] No em dash, no fabricated stats, no fake assets; copy is honest about scope ("not a VPN").
- [x] `npm run package` produces `dist/anti-ip-logger-1.3.0-cws.zip` with runtime files only (verified to load and pass 32/32 browser checks as the extracted copy).
- [ ] Developer account. Chrome Web Store requires a developer registration; there is currently a one-time fee (historically 5 USD). Check the current price in the Chrome Web Store Developer Dashboard. The fee is not paid and nothing is submitted by this repository.

## Hosting the privacy policy

The Web Store requires the privacy policy to be a public URL. It is already served at https://supposedtobescruz.github.io/anti-ip-logger/privacy.html (GitHub Pages from `docs/` on `main`). `docs/privacy.html` is a self-contained page; any static host works equally well.

If you ever move hosts, update `docs/privacy.html` and the store listing; keep the content matching the shipped extension.

## Submission steps when you decide to go

1. Open the Chrome Web Store Developer Dashboard.
2. Register a developer account (the one-time fee applies).
3. New item → upload `dist/anti-ip-logger-1.3.0-cws.zip`.
4. Fill Store listing (from `listing-en.md`, plus TR under localization), Category = Tools.
5. Fill Privacy practices: data collection = none; single purpose text from `listing-en.md`; permission justifications from `permission-justifications.md`.
6. Upload the 6 EN screenshots; optionally upload the TR set under the Turkish localization; upload promo tiles.
7. Set visibility to Public, submit for review.
8. Expect a multi-day review cycle for broad host permissions and the WebRTC privacy permission. If reviewers ask, the store justifications file answers them.

## Regenerating assets

```powershell
node tools/verify-browser.mjs            # EN screenshots into verify-output/
$env:BROWSER_LANG="tr-TR"; node tools/verify-browser.mjs   # TR screenshots
python tools/make-store-assets.py shots store/screenshots      # crop EN 1280x800 (five shots)
python tools/make-store-assets.py shots store/screenshots-tr   # crop TR 1280x800 (five shots)
python tools/make-store-assets.py promo store                  # promo tiles
# the sixth shot (settings) is a 1280x800 top-crop of verify-output/dashboard-settings.png
npm run verify:all                       # gates before any release
npm run package                          # rebuild the zip
```

## Versioning note

`manifest.json` is 1.3.0. Bump both the manifest and the tag before any new submission.

## Automated Edge Add-ons publish (GitHub Actions)

`.github/workflows/edge-release.yml` publishes a new version to Microsoft Edge Add-ons when a `v*` tag is pushed (or via manual `workflow_dispatch`). It uses the Edge Add-ons Update REST API v1.1 with an API key and a Client ID.

What it does, in order: `npm run verify:all`, `npm run package`, `npm run verify:package`, uploads the `dist/anti-ip-logger-*-cws.zip` to the existing product's draft submission, polls the upload operation to completion, then submits for publishing with release notes (tag + pointer to CHANGELOG.md) and polls that operation to completion.

What it cannot do:

- It cannot create the product. The API only updates existing products.
- It cannot update listing metadata: description, logo, screenshots, search terms. Those stay in Partner Center manually.
- It cannot skip certification. A published submission still goes through Edge review before going live.

How to enable it:

1. In Partner Center, go to Microsoft Edge, Publish API, enable the new experience, then Enable, then Create API credentials. Note the Client ID and the API key.
2. Find the product ID (a guid) of the existing Edge Add-ons product.
3. In the GitHub repository, Settings > Secrets and variables > Actions, create three secrets: `EDGE_CLIENT_ID`, `EDGE_API_KEY`, `EDGE_PRODUCT_ID`.

Tag rule: tag must equal the manifest version, e.g. `git tag v1.4.0 && git push origin main --follow-tags`. The workflow has a safety gate: on a tag push, the tag (without the leading `v`) must equal `manifest.json` `version`, otherwise the job fails before uploading. Manual `workflow_dispatch` runs on a non-tag ref skip the gate.

The update-check gist is NOT synced by this workflow. An earlier gist-sync automation was reverted (6a3381a, df1b40e) for lack of a gist-scoped token; gist sync remains manual.

The first publish of 1.3.0 was done manually, because the API only updates existing products and cannot create one.
