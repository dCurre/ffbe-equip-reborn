import { describe, expect, it } from 'vitest';
import { trustUnitIds } from './trust-units';

describe('the units whose TMR and STMR a unit uses', () => {
  it('a unit uses its own', () => {
    expect(trustUnitIds({ id: '207002207' })).toEqual({ own: ['207002207'], other: [] });
  });

  it('the Japan version uses the ones of the unit it is a version of', () => {
    expect(trustUnitIds({ id: 'jp-207002207' }).own).toEqual(['jp-207002207', '207002207']);
  });

  it('a Brave Shift form also uses the ones of the other form', () => {
    expect(trustUnitIds({ id: '207002217', braveShifted: '207002207' })).toEqual({
      own: ['207002217'],
      other: ['207002207'],
    });
    expect(trustUnitIds({ id: 'jp-207002207', braveShift: 'jp-207002217' }).other).toEqual(['jp-207002217', '207002217']);
  });
});
