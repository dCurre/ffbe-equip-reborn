import { describe, expect, it } from 'vitest';
import { trustUnitIds } from './trust-units';

describe('the units whose TMR and STMR a unit uses', () => {
  it('a unit uses its own', () => {
    expect(trustUnitIds({ id: '207002207' })).toEqual({ own: ['207002207'], other: [] });
  });

  it('the Japan version uses the ones of the unit it is a version of', () => {
    const version = { id: 'jp-207002207', variantOf: '207002207' };
    expect(trustUnitIds(version).own).toEqual(['jp-207002207', '207002207']);
  });

  it('a version with another id in Japan uses its own and the ones of the Global unit', () => {
    const duane = { id: 'jp-401014207', variantOf: '401014507', braveShift: 'jp-401014217' };
    expect(trustUnitIds(duane)).toEqual({
      own: ['jp-401014207', '401014507'],
      other: ['jp-401014217', '401014517'],
    });
  });

  it('a Japan unit that is not a version of any uses its own', () => {
    expect(trustUnitIds({ id: 'jp-401014207' }).own).toEqual(['jp-401014207']);
  });

  it('a Brave Shift form also uses the ones of the other form', () => {
    expect(trustUnitIds({ id: '207002217', braveShifted: '207002207' })).toEqual({
      own: ['207002217'],
      other: ['207002207'],
    });
    const base = { id: 'jp-207002207', variantOf: '207002207', braveShift: 'jp-207002217' };
    expect(trustUnitIds(base).other).toEqual(['jp-207002217', '207002217']);
  });
});
