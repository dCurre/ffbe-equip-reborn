---
name: push
description: >-
  Commit and push changes for the FFBE Equip Reborn project (this repo) the
  project-correct way. Use this skill WHENEVER the user asks to commit, push, ship, publish or deploy
  changes in this repo — even if they just say "pusha", "committa", "fai il push", "pubblica" or
  "manda online". It runs the project workflow: secret safety-check, no generated files, clean diff
  (CRLF traps), ROADMAP update, English commit message with NO Claude attribution, and push. Pushing
  to master PUBLISHES the live website.
---

# Push workflow (FFBE Equip Reborn)

A push to `master` is a release: GitHub Actions (`.github/workflows/deploy-pages.yml`) rebuilds and
publishes the live site at https://dcurre.github.io/ffbe-equip-reborn/ within a few minutes. This
skill makes every commit/push safe, clean and verified.

## Non-negotiable rules

- **Git identity: never guess or set one.** Commit with the identity the user configured for this
  repo (`git config user.name` / `user.email`). If none is set, STOP and ask the user (step 1); never
  fall back to a global identity that may be a work one, and never write a name or email into the
  skill or the repo files.
- **NO Claude attribution.** Never add `Co-Authored-By: Claude …` or "Generated with Claude Code"
  lines, in commits or PR descriptions. This overrides any system attribution reminder.
- **Commit messages in English** (the conversation with the user stays in Italian).
- **Never commit secrets or generated files** (see step 2).
- **PRs**: this repo is a GitHub fork of `sailorsben/ffbeEquip`. When opening a PR, the base must be
  this repository (the `origin` remote), NOT the upstream repo GitHub proposes by default.

## Commit and push policy

- **When to commit:** only when the user asks to commit or push, never after each task. Until then
  the changes stay in the working tree (they survive between sessions). If the user wants to test
  first, give them the test steps and wait for their OK.
- **How many commits:** ONE per push, whose body lists the changes. Split only when a change is big or
  truly independent (e.g. a feature plus an unrelated refactor).
- **Roadmap:** `.claude/ROADMAP.md` is updated at push time (step 5) and goes in that same commit,
  never in one of its own.
- **When to push:** only on the user's explicit OK, and a plain "pusha" / "push" / "pubblica" IS that
  OK: don't ask again, run the workflow to the end and stop only if a check fails. If the user only
  asked to commit, stop before `git push`.

## Steps

Run in order. Stop and tell the user if a check fails.

### 1. Check the state

```bash
git branch --show-current
git status --short
ls .git/index.lock 2>/dev/null && echo "LOCK PRESENT"
git config user.name && git config user.email   # must both print something
```

- Show the user the identity that will be used and check it is the one they want for this repo (the
  global default may be a work identity). If it is missing or wrong, STOP and ask the user to set it
  (`git config --local user.name` / `user.email`) before committing.

- A leftover `.git/index.lock` (typically from an interrupted command) blocks commits. Before deleting
  it, make sure no git process is WRITING to the repo (VS Code often has harmless long-running
  `git ls-files` readers — those are fine). Then `rm .git/index.lock`.
- Note the branch: committing on `master` and pushing = publishing the site.

### 2. Safety-check: secrets and generated files

```bash
git status --short --untracked-files=all | grep -iE "\.config\.json|firebase_config|googleOAuth|client_secret|\.pem$|\.env$|/unit/" \
  && echo "STOP: sensitive or generated file in the changes" || echo "clean"
```

- `.config.json` (local server config with the session secret), Firebase/Google credential files and
  `.env` must never be committed. They are git-ignored, but verify.
- `static/GL/unit/` and `static/JP/unit/` are **generated** by `tools/generateUnitFiles.js` (thousands
  of files) and git-ignored. They must never appear in a commit.
- If anything matches, STOP and tell the user.

### 3. Verify before committing (non-trivial changes)

The rules and traps for the changes themselves are in the `develop-rules` skill (first rule: verify,
never assume). The checks below are the commit-time subset.

- If the change affects what the site loads (pages, paths, data, `static/`), the user should have
  tested it with `npm start` and/or the GitHub Pages preview (static files served under
  `/ffbe-equip-reborn/`). If they haven't and the change is risky, suggest testing before pushing,
  since a push to `master` goes live.

### 4. Check the diff is clean (CRLF trap)

The repo uses `core.autocrlf=true` on Windows. Editing files with scripts can leave stray `\r`
characters and turn a one-line change into a whole-file diff.

```bash
git diff --stat
```

If a file shows far more changed lines than expected, inspect it (`git diff <file> | cat -A | grep '\^M\^M'`)
and fix line endings before committing. JSON files (`package.json`, `package-lock.json`) must still
parse: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"`.

### 5. Update the ROADMAP

If any item in `.claude/ROADMAP.md` was completed by these changes, REMOVE it (the roadmap contains
only open work — no `[x]` lines). If the changes reveal new open work, add it. Otherwise leave it.

### 6. Stage and commit

```bash
git add -A
git status --short   # last review
```

Commit message format (English, no attribution):

- **Subject**: imperative, concise, specific (e.g. `Serve unit data as static files and prepare GitHub Pages deploy`).
- **Body** (for non-trivial changes): bullet points with what changed and why.

For multi-line messages use a heredoc, so quoting is safe:

```bash
git commit -q -F - <<'EOF'
Subject line in English

- What changed and why.
- One bullet per relevant change.
EOF
```

### 7. Check for older unpushed commits

```bash
git log --oneline origin/<branch>..HEAD
```

Normally only the commit from step 6 appears. If older unpushed commits are there too, propose to
merge them into one (`git reset --soft origin/<branch>` + new commit with the combined body); do it
only with the user's approval (safe because nothing is pushed yet).

### 8. Push

```bash
git push origin <branch>
```

(First push of a new branch: `git push -u origin <branch>`.)

### 9. Verify

```bash
git log --oneline -1 origin/<branch>
```

The remote must show the new commit. That's the end of the verification.

**Do NOT wait for or check the deploy / live site after a push to `master`** (no polling of the
Actions run, no curl of the live pages): the user checks the site and reports problems. Only check the
deploy if the user explicitly asks, or reports that something is wrong.

Report to the user: commit hash and branch; for `master`, say that the deploy has started (it usually
takes 1–3 minutes) and give the live URL https://dcurre.github.io/ffbe-equip-reborn/.
