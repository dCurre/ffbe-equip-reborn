# FFBE Equip Reborn

FFBE Equip Reborn is a community revival of [FFBE Equip](https://github.com/lyrgard/ffbeEquip), the online
tool for [Final Fantasy Brave Exvius](http://www.finalfantasyexvius.com/). Build units and parties with the
equipment optimizer, search units and gear, browse the item encyclopedia and manage your espers, units and
inventory.

**Live site: https://dcurre.github.io/ffbe-equip-reborn/**

This is an unofficial fan project, not affiliated with or endorsed by Square Enix.

## Authors and credits

FFBE Equip Reborn exists thanks to the people who built and maintained the original tool:

- **Lyrgard** — creator and main author of [FFBE Equip](https://github.com/lyrgard/ffbeEquip)
- **Ben Sailors** ([sailorsben](https://github.com/sailorsben)) — maintainer of
  [FFBE Equip Next](https://github.com/sailorsben/ffbeEquip), which kept the tool alive afterwards
- all the contributors of both projects — their full commit history is preserved in this repository

### Thank you

A heartfelt thank you to **Lyrgard**, who created FFBE Equip in 2017 and developed it for more than five
years; to **Ben Sailors**, who took over in 2022 with FFBE Equip Next and kept it up to date until the very
last days of the game in October 2024; and to the more than 30 people who contributed along the way.

For years this tool helped the Final Fantasy Brave Exvius community build their units and parties. The
optimizer, the encyclopedia, the data extraction and countless hours of updates are their work.
FFBE Equip Reborn exists only to keep that work alive and available to everyone.

FFBE Equip Reborn is maintained by **[dCurre](https://github.com/dCurre)**.

## Project status

The game's servers are closed (the Global version ended in October 2024), so the game data in this
repository is frozen. The site is hosted as a **static website on GitHub Pages**, without a backend.

Most of the tool works: builder and optimizer, unit search, encyclopedia, espers, and units/inventory saved
in your browser. Features that relied on the original server are not available yet and are being migrated:
Google login and Drive sync, shared build links, public unit collections, export to imgur and the
contribution form. See [.claude/ROADMAP.md](.claude/ROADMAP.md) for the full list of open work.

## Run locally

Requirements: [Node.js](https://nodejs.org/) (a current LTS version is recommended) and npm.

```bash
npm install
cp .config.json.sample .config.json   # then set "secret" to a random string
npm start
```

Open http://localhost:3000.

`npm start` first validates `.config.json` and generates the per-unit data files (see below). The first
run takes a little longer; later runs skip the generation if the data didn't change. The `google` and
`firebase` sections of the config can stay disabled.

## How the site is built and deployed

- **The website is the `static/` folder**: plain HTML, CSS and JavaScript, plus the game data as JSON
  (`static/GL` for the Global version, `static/JP` for the Japanese one) and the images. Asset and data
  paths are relative, so the site works under a sub-path such as `/ffbe-equip-reborn/`.
- **Per-unit files**: the builder loads each unit's skills from `static/<server>/unit/<id>.json`. These
  files are generated from `unitsWithSkill.json` by `tools/generateUnitFiles.js` (`npm run build:units`)
  and are not committed.
- **Deploy**: every push to `master` runs the GitHub Actions workflow
  [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml), which generates the unit
  files, assembles the site and publishes it to GitHub Pages in a few minutes.
- **`server.js`** is the original Node/Express server. It is only used for local development and will be
  retired once the remaining server features are migrated to the browser.
- **`tools/`** contains the scripts that extracted the game data from the game files.

## Contributing

Issues and pull requests are welcome on
[dCurre/ffbe-equip-reborn](https://github.com/dCurre/ffbe-equip-reborn/issues). Note that this repository
is a GitHub fork: when opening a pull request, make sure the base repository is `dCurre/ffbe-equip-reborn`.

## License

FFBE Equip Reborn is released under the [ISC License](https://opensource.org/licenses/ISC), like the
original FFBE Equip project. See [LICENSE](LICENSE).
