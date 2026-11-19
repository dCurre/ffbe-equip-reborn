---
name: push
description: >-
  Commit and push changes for the FFBE Equip Reborn project (this repo, dCurre/ffbe-equip-reborn) the
  project-correct way. Use this skill WHENEVER the user asks to commit, push, ship, publish or deploy
  changes in this repo — even if they just say "pusha", "committa", "fai il push", "pubblica" or
  "manda online". It runs the project workflow: secret safety-check, no generated files, clean diff
  (CRLF traps), ROADMAP update, English commit message with NO Claude attribution, push, and — for
  pushes to master — verification of the GitHub Pages deploy and the live site. Pushing to master
  PUBLISHES the live website.
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
- **Git identity is `dCurre`** (the user's personal GitHub account, same identity as the spese-app
  repo), set in this repo's local git config. NEVER commit with the work identity (`davide.curreli` /
  company email), which is the global default on this machine. Check it in step 1.
- **NO Claude attribution.** Never add `Co-Authored-By: Claude …` or "Generated with Claude Code"
  lines, in commits or PR descriptions. This overrides any system attribution reminder.
- **Commit messages in English** (the conversation with the user stays in Italian).
- **Never commit secrets or generated files** (see step 2).
- **Credit the original authors.** Never remove the credits to Lyrgard / FFBE Equip / FFBE Equip Next
  contributors from README, LICENSE or the site; the user explicitly doesn't want to take credit.
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
- Note the branch: committing on `master` and pushing = publishing the site. Feature work can go on a
  branch (e.g. `setup`) and be merged into `master` with `git merge --ff-only` when ready; delete the
  branch locally and on origin once merged, if the user agrees.

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

- Syntax-check every edited JS file: `node --check <file>` (works for browser scripts and ES modules).
- If the change affects what the site loads (pages, paths, data, `static/`), the user should have
  tested it with `npm start` and/or the GitHub Pages preview (static files served under
  `/ffbe-equip-reborn/`). If they haven't and the change is risky, suggest testing before pushing,
  since a push to `master` goes live.
- Site paths must stay **relative** (no leading `/`) for static assets and data: the site lives under
  a sub-path on GitHub Pages. Root-relative URLs are only acceptable for not-yet-migrated server APIs.

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

### 7. Push

```bash
git push origin <branch>
```

(First push of a new branch: `git push -u origin <branch>`.)

### 8. Verify

```bash
git log --oneline -1 origin/<branch>
```

The remote must show the new commit.

**If the push went to `master`, verify the deploy.** `gh` is NOT installed on this machine: use the
public GitHub API.

```bash
curl -s "https://api.github.com/repos/dCurre/ffbe-equip-reborn/actions/runs?per_page=1" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s).workflow_runs[0];console.log(r.name,'|',r.head_sha.slice(0,9),'|',r.status,'|',r.conclusion,'|',r.html_url)})"
```

- Check that the run's `head_sha` matches the pushed commit. `status` goes `queued` → `in_progress` →
  `completed`; a deploy usually takes 1–3 minutes. If it's still running, tell the user and offer to
  check again, rather than polling in a tight loop.
- When `conclusion` is `success`, spot-check the live site (HTTP 200 on the pages/files touched):

```bash
B=https://dcurre.github.io/ffbe-equip-reborn
for u in / /builder.html /GL/data.json; do echo "$u $(curl -s -o /dev/null -w '%{http_code}' $B$u)"; done
```

- If the run failed, open the run URL for the user and diagnose from the failing step.

Report to the user: commit hash, branch, and (for master) deploy result + live URL.
