// Generates one static JSON file per unit from public/<server>/unitsWithSkill.json,
// written to public/<server>/unit/<unitId>.json.
//
// These files replace the former server endpoint GET /:server/unit/:unitId, so the
// builder can load unit skills from any static host (e.g. GitHub Pages).
// The output folders are generated (git-ignored): run `npm run build:units`.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.join(__dirname, '..', 'public');
const SERVERS = ['GL', 'JP'];
const STAMP_FILE = '.generated';
const force = process.argv.includes('--force');

for (const server of SERVERS) {
    const source = path.join(STATIC_DIR, server, 'unitsWithSkill.json');
    const outDir = path.join(STATIC_DIR, server, 'unit');
    const stamp = path.join(outDir, STAMP_FILE);

    // Skip when the files are already up to date with the source (writing ~3000 files is slow on Windows)
    if (!force && fs.existsSync(stamp) && fs.statSync(stamp).mtimeMs >= fs.statSync(source).mtimeMs) {
        console.log(`${server}: unit files up to date (use --force to regenerate)`);
        continue;
    }

    const units = JSON.parse(fs.readFileSync(source, 'utf8'));

    // Start from a clean folder so removed units don't leave stale files behind
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    const unitIds = Object.keys(units);
    for (const unitId of unitIds) {
        fs.writeFileSync(path.join(outDir, unitId + '.json'), JSON.stringify(units[unitId]));
    }
    fs.writeFileSync(stamp, new Date().toISOString());
    console.log(`${server}: generated ${unitIds.length} unit files in ${path.relative(process.cwd(), outDir)}`);
}
