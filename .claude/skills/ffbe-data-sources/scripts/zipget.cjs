// Extracts ONE entry of a release zip of Elvlin/exvius-offline with HTTP Range requests (the packs are 1-1.5 GB: never download them).
// usage: node zipget.cjs <packId> "<entry path in the zip>" <output file> [list]
//   node zipget.cjs kira-event static/text_decoded/F_TEXT_MONSTER_NAME.ndjson out.ndjson
//   node zipget.cjs data-001 x x list      -> prints every entry name and size of the pack
// Notes: github needs an explicit range (`-r from-to`); a suffix range gives 501. Works with zip64 (central directory only).
const { execFileSync } = require('child_process');
const fs = require('fs');
const zlib = require('zlib');
const UA = 'Mozilla/5.0 (compatible; asset-reader)';
const get = (url, extra = []) => execFileSync('curl', ['-sL', '-m', '300', '-A', UA, ...extra, url], { maxBuffer: 1 << 30 });
const range = (url, from, to) => get(url, ['-r', `${from}-${to}`]);

const [packId, entry, out, mode] = process.argv.slice(2);
if (!fs.existsSync('latest.json')) fs.writeFileSync('latest.json', get('https://raw.githubusercontent.com/Elvlin/exvius-offline/HEAD/data/latest.json'));
const pack = JSON.parse(fs.readFileSync('latest.json', 'utf8')).packs.find((p) => p.id === packId);
if (!pack) { console.log('pack not found'); process.exit(1); }

const tail = range(pack.url, pack.size - 65536, pack.size - 1);
const e = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
let cdSize = tail.readUInt32LE(e + 12), cdOff = tail.readUInt32LE(e + 16);
const loc = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x07]));
if (loc >= 0 && (cdOff === 0xffffffff || cdSize === 0xffffffff)) {
  const zoff = Number(tail.readBigUInt64LE(loc + 8)) - (pack.size - tail.length);
  cdSize = Number(tail.readBigUInt64LE(zoff + 40));
  cdOff = Number(tail.readBigUInt64LE(zoff + 48));
}
const cd = range(pack.url, cdOff, cdOff + cdSize - 1);
let o = 0, found = null;
while (o + 46 <= cd.length && cd.readUInt32LE(o) === 0x02014b50) {
  const n = cd.readUInt16LE(o + 28), m = cd.readUInt16LE(o + 30), k = cd.readUInt16LE(o + 32);
  const name = cd.slice(o + 46, o + 46 + n).toString('utf8');
  let csize = cd.readUInt32LE(o + 20), offset = cd.readUInt32LE(o + 42);
  const usize = cd.readUInt32LE(o + 24);
  if (mode === 'list') console.log(name, usize);
  else if (name === entry) {
    const extra = cd.slice(o + 46 + n, o + 46 + n + m);
    if (csize === 0xffffffff || offset === 0xffffffff || usize === 0xffffffff) {
      for (let q = 0; q + 4 <= extra.length; q += 4 + extra.readUInt16LE(q + 2)) {
        if (extra.readUInt16LE(q) !== 1) continue;
        let p = q + 4;
        if (usize === 0xffffffff) p += 8;
        if (csize === 0xffffffff) { csize = Number(extra.readBigUInt64LE(p)); p += 8; }
        if (offset === 0xffffffff) offset = Number(extra.readBigUInt64LE(p));
      }
    }
    found = { method: cd.readUInt16LE(o + 10), csize, offset };
    break;
  }
  o += 46 + n + m + k;
}
if (mode === 'list') process.exit(0);
if (!found) { console.log('entry not found'); process.exit(1); }
const head = range(pack.url, found.offset, found.offset + 29);
const start = found.offset + 30 + head.readUInt16LE(26) + head.readUInt16LE(28);
const raw = range(pack.url, start, start + found.csize - 1);
fs.writeFileSync(out, found.method === 8 ? zlib.inflateRawSync(raw) : raw);
console.log('saved', out, fs.statSync(out).size, 'bytes (compressed', found.csize + ')');
