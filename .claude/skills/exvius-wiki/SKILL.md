---
name: exvius-wiki
description: Read the FFBE wiki (exvius.fandom.com) for game rules, skill/unit mechanics, damage formulas, attack types, killers and mitigation. MUST use whenever the user mentions the wiki/Wikia/Fandom, asks what it says, shares an exvius.fandom.com link, or asks how a game mechanic works. Do not guess. The normal page URL/WebFetch returns HTTP 402; use the read-only MediaWiki API with curl.
---

# Reading the FFBE wiki

Use the public MediaWiki API (no key) because normal page access returns HTTP 402.

```bash
# List sections; use each section's "index"
curl -s -m 20 -A "Mozilla/5.0 (compatible; wiki-reader)" \
  "https://exvius.fandom.com/api.php?action=parse&page=Mechanics&prop=sections&format=json"

# Read one section's wikitext (returned in .parse.wikitext["*"])
curl -s -m 20 -A "Mozilla/5.0 (compatible; wiki-reader)" \
  "https://exvius.fandom.com/api.php?action=parse&page=Mechanics&section=15&prop=wikitext&format=json"
```

## Rules and pitfalls

- `section=N` is the section **index**, not its heading number. Get it from the section listing and verify the returned heading; an off-by-one error was observed.
- For other pages, use `page=Skill_Name` (underscores); pass only the page name, never project or user data.
- The API returns wikitext (templates and `<math>` included). Interpret it; do not paste raw wikitext to the user. Keep output manageable with `node -e` or `head -c`.
- Read-only: never use `action=edit` or any write operation.
- Permission is configured in `.claude/settings.local.json` (git-ignored): `Bash(curl * https://exvius.fandom.com/api.php?*)`. If curl is refused, tell the user; do not seek another access route.

