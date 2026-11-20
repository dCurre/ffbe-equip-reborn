// Golden master of the optimizer: the full search (all type combinations) on the real GL data, with the item pool
// reduced to the best ITEMS_PER_TYPE per type so it takes about a second per unit. Pins what the code does today.
import { runOptimizer } from '../helpers/optimizerRun.js';

const ENEMY = { def: 500, spr: 300 };
export const ITEMS_PER_TYPE = 80;
// [unit id, skill id, what it covers]
export const CASES = [
    ['100000102', '201130'], // Rain, Power Break: physical, one weapon + shield
    ['100012405', '219360'], // single-wield build with an empty slot
    ['100037717', '1001010'], // dual wield
];

export function computeOptimizerGolden() {
    // JSON round trip: empty slots are undefined/null and vm arrays have other prototypes
    return JSON.parse(JSON.stringify(Object.fromEntries(CASES.map(([unitId, skillId]) => {
        const { combos, best } = runOptimizer(unitId, skillId, { enemy: ENEMY, itemsPerType: ITEMS_PER_TYPE });
        return [`${unitId}/${skillId}`, { combos: combos.length, avg: best.value.avg, build: best.build.slice(0, 11).map((i) => (i ? i.id : null)) }];
    }))));
}
