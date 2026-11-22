// Golden master of the build calculations on the real GL game data: for every unit, every damage/skill
// formula built from its real actives, magics and limit burst, a few fixed builds and enemies.
// It pins what the code does today (not that it is right): see test.golden.js.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { loadBuilderEnv, makeUnitBuild, makeEnemy } from '../helpers/builderEnv.js';

const GL = new URL('../../../public/GL/', import.meta.url);
const readJson = (name) => JSON.parse(fs.readFileSync(new URL(name, GL), 'utf8'));

const WEAPONS = ['dagger', 'sword', 'greatSword', 'katana', 'axe', 'hammer', 'mace', 'spear', 'fist', 'rod', 'staff', 'bow', 'gun', 'whip', 'throwing', 'harp'];
const SHIELDS = ['lightShield', 'heavyShield'];
const HEADS = ['hat', 'helm'];
const BODIES = ['clothes', 'lightArmor', 'heavyArmor', 'robe'];

// Fixed scenarios, kept few so the whole run stays fast.
const SCENARIOS = [
    { name: 'naked-vs-plain', profile: 'none', enemy: {} },
    {
        name: 'equipped-vs-resists', profile: 'single', elements: ['fire'],
        enemy: { def: 500, spr: 300, races: ['beast', 'human', 'demon'], resists: { fire: 50, ice: -50, lightning: 20 }, imperils: { fire: 10 } }
    },
    {
        name: 'dualwield-buffed-vs-broken', profile: 'dual', buffs: { atk: 50, mag: 50, def: 50, spr: 50 },
        enemy: { def: 200, spr: 200, breaks: { def: 50, spr: 30 }, buffs: { def: 20 }, imperils: { sword: 30, dagger: 30 } }
    }
];

// One unit out of SAMPLE_EVERY is stored with its full values in calc.json.
export const SAMPLE_EVERY = 140;

// JSON turns NaN/undefined into null: keep them as text so the comparison with the saved file is exact.
// (Skills that are not damage, e.g. heals or imperils, return no min/avg/max.)
const round = (n) => (typeof n === 'number' && !Number.isNaN(n) ? Math.round(n * 1e4) / 1e4 : String(n));

function itemScore(item) {
    const percent = Object.keys(item).filter((key) => key.endsWith('%')).reduce((sum, key) => sum + (item[key] || 0), 0);
    return (item.atk || 0) + (item.mag || 0) + (item.def || 0) + (item.spr || 0) + (item.hp || 0) / 10 + (item.mp || 0) / 10 + percent * 10;
}

export function computeGolden({ onlyUnits } = {}) {
    const ctx = loadBuilderEnv();
    const passives = readJson('unitsWithPassives.json');
    const withSkills = readJson('unitsWithSkill.json');
    const items = readJson('data.json');
    // Same preparation as DataStorage.prepareAllItemsVersion (builder/dataStorage.js): the raw data has no avg variance.
    for (const item of items) {
        item.meanDamageVariance = 1;
        if (item.damageVariance) {
            item.damageVariance.avg = (item.damageVariance.min + item.damageVariance.max) / 2;
            item.meanDamageVariance = item.damageVariance.avg;
        }
    }

    // Best items per type, strongest first, ties broken by id: deterministic and varied (real caps, killers...).
    const byType = {};
    for (const item of items) (byType[item.type] ||= []).push(item);
    for (const type of Object.keys(byType)) {
        byType[type].sort((a, b) => itemScore(b) - itemScore(a) || String(a.id).localeCompare(String(b.id)));
    }
    const pick = (types, equip) => {
        const type = types.find((t) => equip.includes(t) && byType[t]);
        return type ? byType[type][0] : null;
    };

    function buildFor(unit, profile) {
        const slots = new Array(12).fill(null);
        if (profile === 'none') return slots;
        const equip = unit.equip || [];
        const weaponType = WEAPONS.find((t) => equip.includes(t) && byType[t]);
        if (weaponType) {
            slots[0] = byType[weaponType][0];
            slots[1] = profile === 'dual' ? byType[weaponType][1] || null : pick(SHIELDS, equip);
        }
        slots[2] = pick(HEADS, equip);
        slots[3] = pick(BODIES, equip);
        if (equip.includes('accessory')) { slots[4] = byType.accessory[0]; slots[5] = byType.accessory[1]; }
        if (equip.includes('materia')) for (let i = 0; i < 4; i++) slots[6 + i] = byType.materia[i];
        return slots;
    }

    const result = {};
    const errors = {};
    for (const unitId of onlyUnits || Object.keys(passives).sort()) {
        const unit = passives[unitId];
        const skills = withSkills[unitId];
        if (!unit || !skills) continue;
        const stats = {};
        const base = unit.stats.maxStats, pots = unit.stats.pots || {};
        for (const stat of Object.keys(base)) stats[stat] = base[stat] + (pots[stat] || 0);

        const formulas = [];
        for (const skill of [...skills.actives, ...skills.magics]) formulas.push([skill.id, ctx.formulaFromSkill(skill)]);
        if (skills.lb) formulas.push(['lb', ctx.formulaFromSkill(skills.lb, false, true)]);

        const values = [];
        for (const scenario of SCENARIOS) {
            const unitBuild = makeUnitBuild(ctx, { stats, buffs: scenario.buffs, level: 100 });
            unitBuild.unitShift.unit = unit; // the real unit (equip, rarity, passives)
            unitBuild.innateElements = scenario.elements || [];
            const itemAndPassives = buildFor(unit, scenario.profile).concat(unit.skills || []);
            for (const [skillId, formula] of formulas) {
                if (!formula || formula.notSupported) continue;
                try {
                    unitBuild.formula = formula;
                    const v = ctx.calculateBuildValueWithFormula(itemAndPassives, unitBuild, makeEnemy(ctx, scenario.enemy), formula, 'avg');
                    values.push([scenario.name, skillId, round(v.min), round(v.avg), round(v.max)]);
                } catch (error) {
                    values.push([scenario.name, skillId, 'error: ' + error.message]);
                    errors[error.message] = (errors[error.message] || 0) + 1;
                }
            }
        }
        const hash = crypto.createHash('sha1').update(JSON.stringify(values)).digest('hex').slice(0, 16);
        result[unitId] = { count: values.length, hash, values };
    }
    return { result, errors };
}
