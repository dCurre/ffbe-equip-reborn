---
name: develop-rules
description: >-
  Use when analysing or changing FFBE Equip Reborn code/files (features, fixes, cleanup, refactors,
  dependencies, or removing code). For Angular, also read `angular-developer`; for commits/pushes,
  use `push`.
---

# Development rules

- Before wrapping up any major feature or refactoring, always run `/drywall:scan` to verify that no duplicated code was introduced.
- Before calling code unused, grep all references (`src/`, `static/`, `tools/`, JSON, dynamic names; `git log -S`). State what you did not verify. Ask when ambiguous. For legacy ports, compare with the original JS/HTML/CSS and note differences.
- After code changes run `npx ng build` and `npx ng test --watch=false`; report failures.
- Dependencies: give the owner the `npm install`/`npm uninstall` command; don't edit `package.json` by hand.
- Files are CRLF (`core.autocrlf=true`); if an edit fails, reread the lines first.
- Never remove or weaken credits to Lyrgard, Ben Sailors and contributors (README, LICENSE, footers, `package.json`).
