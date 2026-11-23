# FFBE Equip Reborn
- Work on `master`; a push deploys the site. Open work: `.claude/ROADMAP.md`.
- No local servers left running (owner starts them). No screenshots: compare code, owner checks on screen.
- Components: own folder with `.ts`/`.html`/`.css`; no inline template/styles, no HTML strings, no `innerHTML`. Reuse `src/app/shared/components/` before new markup/CSS; icons go in `shared/components/icon/icon-map.ts` (one entry per icon: kind, tooltip, path/file; show it with `<app-icon name>`, `<i icon>` or `<img icon>`).
- Commit only when asked, as one descriptive commit (roadmap included); push only with OK (`push` skill).
- Keep extraction tools (`tools/` scripts) and used data; grep every reference before proposing a deletion.
