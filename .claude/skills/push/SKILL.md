---
name: push
description: >-
  Commit and push changes for the FFBE Equip Reborn repository. Use whenever the user asks to
  commit, push, ship, publish, or deploy changes (including "pusha", "committa", "fai il push",
  "pubblica", or "manda online"). Pushing to master publishes the live website.
---

# Push workflow

Pushing `master` deploys the site via GitHub Actions (https://dcurre.github.io/ffbe-equip-reborn/).

## Rules
- English commit messages, no Claude attribution lines.
- Commit only when asked; "committa" = commit, no push. "push"/"pusha"/"pubblica" is enough authorization to push.
- If the user wants to test first, give test steps and wait. Stop and report any failed check.

## Steps
1. `git branch --show-current; git status --short; git config user.name; git config user.email` — confirm the identity is right, else stop and ask. Remove a stale `.git/index.lock` only if no git process is running.
2. Risky untested changes (pages, paths, data, `public/`): recommend testing first.
3. `git diff --stat`. With `core.autocrlf=true`, a whole-file diff means stray `\r`: fix line endings. Validate changed JSON with `node -e "JSON.parse(require('fs').readFileSync('<file>','utf8'))"`.
4. Update `.claude/ROADMAP.md`: remove done items, add new open work (no `[x]`). Then `git add -A` and review `git status --short`.
5. One commit: imperative English subject, body bullets for non-trivial changes (`git commit -q -F -` with a heredoc).
6. Push only if authorized: `git push origin <branch>` (`-u` for a new branch). Do not poll Actions or the live site unless asked.
