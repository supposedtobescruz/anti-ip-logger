# Contributing to Anti IP Logger

Thanks for your interest. This document explains how to propose changes.

## What you need

- Node.js 20.12 or newer. No dependency install step: the runtime has no npm dependencies and the tools need none beyond Node.
- A Chromium browser with developer mode for live testing (Brave or Edge recommended; Opera/Vivaldi expected to work, untested).

## Before you start

- Project invariants that still apply: Manifest V3, network requests only to the defined list sources, no telemetry, no remote code, WCAG AA contrast for UI, no em dashes in project files.
- Open an issue before starting a large change so we can agree on the shape of it.

## Making a change

1. Fork and branch from `main`.
2. Make the change. Keep it consistent with the surrounding code: vanilla JavaScript, ES modules, 2-space indent, double quotes, semicolons.
3. Run the gates:
   ```powershell
   npm run verify:all
   ```
   and, if you touched the UI or blocked page:
   ```powershell
   npm run verify:browser
   ```
   If Brave/Chrome is not in the default location, set `BRAVE_PATH`.
4. Update documentation you invalidate: `README.md`, `readme/readmeTR.md`, `THIRD-PARTY-LICENSES.md` (data sources or fonts).

## Commits

- One logical change per commit.
- English messages in `type: summary` form. Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.
- `verify:all` must pass before the commit is made.

## Data and sources

- New domain sources: add them to `data/sources.json`, then `npm run build`. Source licenses must be compatible and listed in `THIRD-PARTY-LICENSES.md`.
- Do not hand-edit generated files (`data/core-*.json`, `data/meta.json`, `rules/core.json`). Change the inputs or `tools/build-lists.mjs`.

## Privacy rules for contributions

- No new network requests except list refreshes.
- No telemetry, analytics, crash reporting or remote feature flags.
- No full URLs in the event log. Domain + short text only.

## Licensing

By contributing you agree that your contributions are licensed under the project license (MIT).
