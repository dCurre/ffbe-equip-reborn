// The portraits of the monsters of `dungeonMonsters.json` (run it after `monsters.mjs`): downloaded from the asset
// dump of DaddyRaegen and made 80 px webp files in `public/img/monsters`. Needs `sharp` (npm install -D sharp).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { cached, published, ROOT } from './sources.mjs';

const DUMP = 'https://raw.githubusercontent.com/DaddyRaegen/ffbe_asset_dump/main/monster_icon';
const OUT = path.join(ROOT, 'public', 'img', 'monsters');
const { monsters } = JSON.parse(fs.readFileSync(published('dungeonMonsters'), 'utf8'));
const wanted = [...new Set(monsters.map((m) => m.icon).filter(Boolean))];

fs.mkdirSync(cached('icons'), { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
async function make(id) {
  const out = path.join(OUT, `${id}.webp`);
  if (fs.existsSync(out)) return;
  const source = cached(`icons/${id}.png`);
  if (!fs.existsSync(source)) {
    const response = await fetch(`${DUMP}/monster_icon_${id}.png`, { headers: { 'User-Agent': 'asset-reader' } });
    if (!response.ok) throw new Error(`${response.status} monster_icon_${id}.png`);
    fs.writeFileSync(source, Buffer.from(await response.arrayBuffer()));
  }
  await sharp(source).resize(80, 80, { fit: 'inside' }).webp({ quality: 80 }).toFile(out);
}
for (let i = 0; i < wanted.length; i += 8) await Promise.all(wanted.slice(i, i + 8).map(make));
// the portraits nothing shows any more
const kept = new Set(wanted.map((id) => `${id}.webp`));
for (const file of fs.readdirSync(OUT)) if (!kept.has(file)) fs.rmSync(path.join(OUT, file));

const bytes = [...kept].reduce((sum, file) => sum + fs.statSync(path.join(OUT, file)).size, 0);
const without = monsters.filter((m) => !m.icon).length;
console.log({ monsters: monsters.length, withoutPortrait: without, pictures: kept.size, bytes });
