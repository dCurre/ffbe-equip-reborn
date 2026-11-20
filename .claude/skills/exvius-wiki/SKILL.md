---
name: exvius-wiki
description: Read pages of the FFBE wiki (exvius.fandom.com) for game rules, skill and unit mechanics. Use WHENEVER the user mentions the wiki ("wiki", "la wiki", "wikia", "fandom", "controlla/guarda sulla wiki", "cosa dice la wiki") or shares an exvius.fandom.com link, and whenever you need what the game does (damage formulas, damage/attack types, killers, mitigation, a skill's behaviour) instead of guessing. The normal page URL and WebFetch return HTTP 402: use the MediaWiki API with curl.
---

# Reading the FFBE wiki

Pages like `https://exvius.fandom.com/wiki/Mechanics` answer **402** to WebFetch and the web-fetch agent. The public MediaWiki API works with curl (a read-only call, no key):

```bash
# section list (note each section's "index")
curl -s -m 20 -A "Mozilla/5.0 (compatible; wiki-reader)" \
  "https://exvius.fandom.com/api.php?action=parse&page=Mechanics&prop=sections&format=json"

# wikitext of one section (the text comes back in .parse.wikitext["*"])
curl -s -m 20 -A "Mozilla/5.0 (compatible; wiki-reader)" \
  "https://exvius.fandom.com/api.php?action=parse&page=Mechanics&section=15&prop=wikitext&format=json"
```

## Traps

- **`section=N` is NOT the heading number** (1.13 is not 13). Use the `index` from the sections listing, and check the heading in the first line of the answer: it was off by one when verified.
- Use `page=Skill_Name` with underscores. Send only the page name: no project or user data in the URL.
- Output is wikitext (templates, `<math>`): read it, don't paste it to the user. Pipe through `node -e` / `head -c` to keep it short.
- Read only. Do not call `action=edit` or any write action.
- The permission rule lives in `.claude/settings.local.json` (not committed, in `.gitignore`): `Bash(curl * https://exvius.fandom.com/api.php?*)`. If curl is refused, tell the user instead of looking for another route.

## What is already established (verified 2026-11-20, page "Mechanics")

- Sections 1.2-1.4: exact formulas for Physical, Magic, Hybrid damage; 1.13 "Damage Types": attack type vs damage type, and what the **Fixed** attack type ignores (see below).
- In the game data (`tools/GL/sources/skills_ability.json`) `attack_type: "None"` is the wiki's **Fixed** attack type. The repo copies it as `mechanism: "none"`, which `calculateBuildValueWithFormula` does not handle.
