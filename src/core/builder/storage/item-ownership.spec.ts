import { describe, expect, it } from 'vitest';
import { getOwnedCardNumber } from './item-ownership';

/** The parts of the storage that the ownership of a card reads. */
const storage = (inventory: Record<string, unknown>, used: Record<string, number> = {}) =>
  ({ itemInventory: inventory, alreadyUsedItems: used, unstackablePinnedItems: [] }) as never;

describe('owned vision cards', () => {
  it('counts the copies of every level the card is owned at', () => {
    const owned = storage({ '100': 3, visionCardsLevels: { '100': [3, 4, 4] } });
    expect(getOwnedCardNumber(owned, '100')).toEqual({ total: 3, available: 3 });
  });

  it('owns nothing of a card without copies', () => {
    expect(getOwnedCardNumber(storage({ visionCardsLevels: {} }), '100')).toEqual({ total: 0, available: 0 });
  });

  it('puts the copies without a level at level 1, once', () => {
    expect(getOwnedCardNumber(storage({ '100': 2, visionCardsLevels: {} }), '100')).toEqual({ total: 2, available: 2 });
  });

  it('leaves out the copies another build uses', () => {
    const owned = storage({ '100': 2, visionCardsLevels: { '100': [3, 4] } }, { '100-3': 1 });
    expect(getOwnedCardNumber(owned, '100')).toEqual({ total: 2, available: 1 });
  });
});
