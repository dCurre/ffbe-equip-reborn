import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isApplicable } from '../../../core/builder/item-conditions';
import { exclusiveForbidAccess } from '../../game/helpers/item';
import { wikiUrl } from '../../shared/helpers/wiki';
import { filterByName, GameUnit, unitImage } from './unit-model';

const units: Record<string, GameUnit> = JSON.parse(readFileSync('public/ALL/units.json', 'utf8'));

describe('the units of the Japan version', () => {
  it('shows no Japanese name', () => {
    const japanese = Object.values(units).filter((unit) => /[぀-ヺー-ヿ一-鿿]/.test(unit.name));
    expect(japanese.map((unit) => unit.id)).toEqual([]);
  });

  it('finds a unit by its English and its Japanese name', () => {
    for (const text of ['item master rikku', 'アイテムマスター']) {
      const found = filterByName(Object.values(units), text).map((unit) => unit.id);
      expect(found).toEqual(['210003307', '210003317']);
    }
  });

  it('links a Japan unit to the Global unit of the same character, not to the one with the same id', () => {
    expect(units['jp-401014207'].name).toBe('Dark Knight Duane [JP]');
    expect(units['jp-401014207'].variantOf).toBe('401014507');
    expect(units['401008517'].variantOf).toBe('401010017');
    expect(units['jp-401014217'].braveShifted as unknown).toBe('jp-401014207');
    const picture = unitImage(units['jp-401014207'], undefined);
    expect(picture).toBe('img/units/unit_icon_jp-401014207.png');
    expect(existsSync(`public/${picture}`)).toBe(true);
  });

  it('gives that unit its own TMR and STMR', () => {
    const items: { tmrUnit?: string; stmrUnit?: string; name: string }[] = JSON.parse(
      readFileSync('public/ALL/data.json', 'utf8'),
    );
    const names = (id: string) =>
      items.filter((item) => item.tmrUnit === id || item.stmrUnit === id).map((i) => i.name);
    expect(names('jp-401014207')).toEqual(expect.arrayContaining(['レネゲイド', 'リモースヘルム']));
    expect(names('401014207')).not.toContain('レネゲイド');
  });

  it('lets a [JP] version use the exclusive items of its unit, and not a unit that only has the same id', () => {
    const goggles = { exclusiveUnits: ['249000507'] };
    expect(isApplicable(goggles, units['jp-249000507'])).toBe(true);
    expect(exclusiveForbidAccess(goggles as never, 'jp-249000507', units as never)).toBe(false);
    expect(isApplicable({ exclusiveUnits: ['401014607'] }, units['jp-401014607'])).toBe(false);
  });

  it('links a Brave Shift with a name of its own to the page of its base unit', () => {
    expect(wikiUrl(units['jp-249000517'].wikiEntry!)).toBe(
      'https://exvius.fandom.com/wiki/Berserker_Rikku/JP#Brave_Shift',
    );
  });
});
