import { TestBed } from '@angular/core/testing';
import { Inventory } from './inventory';
import { StaticData } from './static-data';
import { UserData } from './user-data';

const files: Record<string, unknown> = {
  itemInventory: { '100': 1, enchantments: {}, visionCardsLevels: {} },
  units: {
    version: 4,
    '100000107': { number: 2, farmable: 1 },
    '401013807': { number: 2, farmable: 1, nv: 1 }, // an NV unit of an older save: copies in `number` too
    '401013907': { number: 1, farmable: 0, nv: 0 },
  },
  consumables: {},
};

describe('Inventory', () => {
  it('loads the user data and keeps the copies of an NV unit in `nv` only', async () => {
    const write = vi.fn(async () => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: UserData, useValue: { loggedIn: () => true, read: async (table: string) => structuredClone(files[table]), write } },
        {
          provide: StaticData,
          useValue: {
            get: async () => ({
              '100000107': { min_rarity: '5' },
              '401013807': { min_rarity: 'NV' },
              '401013907': { min_rarity: 'NV' },
            }),
          },
        },
      ],
    });
    const inventory = TestBed.inject(Inventory);
    await inventory.load();
    expect(inventory.status()).toBe('loaded');
    expect(inventory.units()['100000107'].number).toBe(2);
    expect(inventory.units()['401013807']).toMatchObject({ number: 0, nv: 2 });
    expect(inventory.units()['401013907']).toMatchObject({ number: 0, nv: 0 });
    expect(write).toHaveBeenCalled(); // the migration saved the units
  });
});
