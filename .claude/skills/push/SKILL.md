---
name: push
description: >-
  Commit and push changes for the FFBE Equip Reborn project (this repo, dCurre/ffbe-equip-reborn) the
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

- **Push only on the user's explicit OK — but a plain "pusha" / "push" / "pubblica" IS that OK.** When
  the user asked to push in this turn, don't ask again: run the workflow to the end. Stop only if a
  safety check fails. If the user only asked to commit, stop before `git push`.
- **When the user says they want to test first** ("le testo localmente e poi vediamo"), make the
  changes, give them the test commands, and commit/push only after they confirm it works.
- **Commit one scope at a time, right after the user has tested and approved it** (the commits are
  what survives between sessions). Don't push without the OK. `.claude/ROADMAP.md` is not committed on
  its own: update it and commit it at push time. Before pushing, list the unpushed commits
  (`git log --oneline origin/master..HEAD`) and propose to the user which ones can be merged.
- **Git identity is `dCurre`** (the user's personal GitHub account), set in this repo's local git
  config. NEVER commit with the work identity (`davide.curreli` / company email), which is the global
  default on this machine. Check it in step 1.
- **NO Claude attribution.** Never add `Co-Authored-By: Claude …` or "Generated with Claude Code"
  lines, in commits or PR descriptions. This overrides any system attribution reminder.
- **Commit messages in English** (the conversation with the user stays in Italian).
- **Never commit secrets or generated files** (see step 2).
- **PRs**: this repo is a GitHub fork of `sailorsben/ffbeEquip`. When opening a PR, the base must be
  `dCurre/ffbe-equip-reborn`, NOT the upstream repo GitHub proposes by default.

## Steps

Run in order. Stop and tell the user if a check fails.

### 1. Check the state

```bash
git branch --show-current
git status --short
ls .git/index.lock 2>/dev/null && echo "LOCK PRESENT"
git config user.name   # must print dCurre
```

- If `git config user.name` is not `dCurre`, STOP: the repo-local identity is missing (e.g. fresh
  clone). Ask the user to set it (`git config --local user.name` / `user.email`, same values as the
  spese-app repo) before committing.

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

### 7. Review the unpushed commits

```bash
git log --oneline origin/<branch>..HEAD
```

Before pushing, propose to the user which commits can be merged (same scope, small fixes of a previous
commit, docs-only commits). Merge only what the user approves (`git reset --soft` + new commit, or
`git commit --amend`; safe because nothing is pushed yet).

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
