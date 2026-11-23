# FFBE Equip Reborn

A revival of [FFBE Equip](https://github.com/lyrgard/ffbeEquip), the web tool for
[Final Fantasy Brave Exvius](http://www.finalfantasyexvius.com/). It has the equipment optimizer to build
units and parties, unit search, the item encyclopedia, and pages to keep track of your own units, inventory
and espers.

**Live site: https://dcurre.github.io/ffbe-equip-reborn/**

Unofficial fan project, not affiliated with or endorsed by Square Enix.

## Where it comes from

The tool was written by **Lyrgard**, who started FFBE Equip in 2017 and kept working on it for more than five
years. In 2022 [sailorsben](https://github.com/sailorsben) took it over as
[FFBE Equip Next](https://github.com/sailorsben/ffbeEquip) and updated it until the Global version of the game
closed in October 2024. More than 30 people contributed to the two projects, and their commit history is kept in
this repository. The optimizer, the encyclopedia and the data extraction are their work; this project only
keeps the site online and rebuilds it in Angular.

It is maintained by [dCurre](https://github.com/dCurre).

## What is here

The game servers are closed, so the game data (Global and Japan, merged in `public/ALL`) is frozen. The data
comes from the dumps of [aEnigmatic](https://github.com/aEnigmatic/ffbe-jp), and the last Japan icons come from the
[ffbe_asset_dump](https://github.com/DaddyRaegen/ffbe_asset_dump) of DaddyRaegen.

The menu has these sections:

- **Home**: the landing page, with a link to each section.
- **Unit builder**: the optimizer. You set a goal (including custom ones), the enemy and the build rules, and it
  looks for the best equipment. You can get a link to the build or copy it as text. With a login it uses the
  equipment you own, saves your teams and enables the Parameter challenges.
- **Encyclopedia**: search and filter every item by name, stats, abilities or TMR unit, by equipment type,
  element, status ailment and killer.
- **Unit search**: filter units by rarity, equipment type, game series and skills (attack, defense, support, stat
  buffs, breaks, tank abilities, draw attacks), optionally only the ones you own.
- **My inventory**: the items you own, with filters, export and import.
- **My units**: the units you own, filtered by owned, 7★ awakened, time limited or TMR Moogle, with a link to
  share your collection and import of units and consumables.
- **My Espers**: your espers and their builds, with a link to share an Esper build.
- **Data import**: load your units, inventory, consumables and espers from an FFBE Offline save.
- **Contribute**: report a bug or suggest an improvement; both open a GitHub issue.

The privacy policy is linked from the footer.

You can use the site without an account. If you log in with Google, your units, inventory, espers and saved
teams are stored in a hidden app folder of your own Google Drive, one set per game server. The site can only
see that folder, and it writes to it directly from the browser. Theme and login tokens stay in the browser's
`localStorage`.

The site is a static Angular app on GitHub Pages. The only server part is a small Cloudflare Worker
([`worker/`](worker)) that stores shared build and unit collection links, and keeps the Google renewal token so
the login lasts. Links shared on FFBE Equip Next no longer work.

How to import your data, use the builder and what the Google login stores is explained in the
[wiki](https://github.com/dCurre/ffbe-equip-reborn/wiki). Open work is in [.claude/ROADMAP.md](.claude/ROADMAP.md).

## Run it locally

You need Node.js 24 (see [`.node-version`](.node-version)) and npm.

```bash
npm install
npm run dev
```

Then open http://localhost:4200.

`npm run dev` first writes the per-unit files the builder loads (`public/ALL/unit/<id>.json`, built from
`unitsWithSkill.json` by `tools/generateUnitFiles.js`, also `npm run build:units`). They are not committed, and the command skips them when they
are up to date.

### Tests

- `npm test` compiles the calculation core and runs the damage, stat and optimizer tests in `test/static`,
  including the golden files. Regenerate those only on purpose, with `npm run test:golden:update`.
- `npx ng test` runs the Angular component and service tests (Vitest).

## How it is organized

- `src/app/`: the Angular app, one folder per page in `features/`, shared components and services in `shared/`.
- `src/core/`: the calculation core (formulas, stats, damage, optimizer), with no Angular in it.
- `public/`: game data and images, copied into the build as they are. Paths are relative, so the site also
  works under a sub-path like `/ffbe-equip-reborn/`.
- `tools/`: `generateUnitFiles.js` (the per-unit files), `mergeServers.js` (how the Global and Japan data became
  `public/ALL`). The extraction scripts and the raw game data were removed
  (they are in the history).
- `worker/`: the Cloudflare Worker.
- Every push to `master` runs [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml), which
  builds the unit files and the site and publishes it to GitHub Pages.

## Contributing

Issues and pull requests are welcome at
[dCurre/ffbe-equip-reborn](https://github.com/dCurre/ffbe-equip-reborn/issues). The repository is a GitHub
fork, so when you open a pull request check that the base repository is `dCurre/ffbe-equip-reborn`.

## License

[ISC](https://opensource.org/licenses/ISC), the same as the original FFBE Equip. See [LICENSE](LICENSE).
