import type { BuilderState } from './builder-state';
import { setEnemy } from './enemy';

describe('enemy', () => {
  it('fills the stats, resistances and breaks of the enemy', () => {
    const state = () => {
      let value: unknown;
      return { set: (v: unknown) => (value = v), get: () => value };
    };
    const names = ['monster', 'monsterBuffs', 'monsterBreaks', 'monsterBreakability', 'monsterResists', 'races'];
    const signals = Object.fromEntries(names.map((name) => [name, state()]));
    const s = { ...signals, refresh: () => undefined } as unknown as BuilderState;
    const enemy = {
      name: 'a',
      def: 100,
      spr: null,
      races: ['demon'],
      traits: { absorb: ['dark'], weak: [{ name: 'fire', percent: -50 }] },
    };
    setEnemy(s, enemy, { def: 50 });
    expect(signals['monster'].get()).toEqual({ atk: '', mag: '', def: '100', spr: '' });
    expect(signals['monsterResists'].get()).toMatchObject({ fire: '-50', dark: '999', ice: '' });
    expect(signals['monsterBreakability'].get()).toEqual({ atk: false, def: false, mag: false, spr: false });
    setEnemy(s, enemy, {}, true);
    expect(signals['monsterBreakability'].get()).toEqual({ atk: true, def: true, mag: true, spr: true });
  });
});
