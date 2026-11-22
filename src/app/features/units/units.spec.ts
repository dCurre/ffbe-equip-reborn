import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Inventory } from '../../shared/services/inventory';
import { StaticData } from '../../shared/services/static-data';
import { GameUnit } from './unit-model';
import { Units } from './units';

const unit = (id: string, name: string, min: string, max: string, extra: Partial<GameUnit> = {}): GameUnit => ({
  id,
  name,
  min_rarity: min,
  max_rarity: max,
  equip: ['sword'],
  ...extra,
});

const units = Object.fromEntries(
  [unit('100000107', 'Rain', '5', '7'), unit('100000206', 'Fina', '4', '6'), unit('100000305', 'Sakura', '3', '5')].map(
    (u) => [u.id, u],
  ),
);

const gameData: Record<string, unknown> = {
  units,
  releasedUnits: { '100000107': { type: 'story' }, '100000206': { type: 'event' }, '100000305': { type: 'summon' } },
  data: [{ id: '500', name: 'Rain TMR', tmrUnit: '100000107' }],
  lastItemReleases: [{ date: 'May 1st, 2024', sources: [{ type: 'banner', units: ['100000206'] }] }],
};

describe('Units page', () => {
  let page: HTMLElement;
  let inventory: Inventory;
  let fixture: ReturnType<typeof TestBed.createComponent<Units>>;

  const text = () => page.textContent ?? '';
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: StaticData, useValue: { get: async (name: string) => gameData[name] } },
      ],
    });
    inventory = TestBed.inject(Inventory);
    inventory.status.set('loaded');
    inventory.units.set({ '100000107': { number: 1, farmable: 1, sevenStar: 1, farmableStmr: 1 } });
    fixture = TestBed.createComponent(Units);
    await settle();
    page = fixture.nativeElement;
  });

  it('shows the units by rarity, each under the heading of its rarity', () => {
    const headings = [...page.querySelectorAll('.separator')].map((h) => h.textContent?.trim());
    expect(headings).toEqual(['★★★★★☆☆', '★★★★☆☆', '★★★☆☆']);
    expect(page.querySelectorAll('.unit').length).toBe(3);
    expect(page.querySelector('.unit.owned.sevenStars')?.textContent).toContain('Rain');
  });

  it('counts the owned units in the statistics', () => {
    expect(page.querySelector('app-unit-collection-stats tbody tr')?.textContent?.replace(/\s+/g, ' ')).toContain(
      '1/1(1)',
    );
  });

  it('shows the TMR still to farm and the buttons to change the collection', () => {
    const rain = page.querySelector('.unit.owned') as HTMLElement;
    expect(rain.querySelector('.trust-counter.tmr')?.textContent?.replace(/\s+/g, '')).toBe('TMR0/1');
    expect(rain.querySelector('.actions .edit')).not.toBeNull();
  });

  it('adds a copy of a unit and marks the inventory to be saved', async () => {
    const save = vi.spyOn(inventory, 'save').mockResolvedValue();
    (page.querySelector('.unit.notOwned .action-button') as HTMLElement).click();
    await settle();
    expect(inventory.units()['100000206'].number).toBe(1);
    expect(page.querySelectorAll('.unit.owned').length).toBe(2);
    save.mockRestore();
    clearTimeout((inventory as unknown as { saveTimer: ReturnType<typeof setTimeout> }).saveTimer);
  });

  it('searches by name and keeps the owned units only on request', async () => {
    const box = page.querySelector('.search') as HTMLInputElement;
    box.value = 'sak';
    box.dispatchEvent(new Event('input'));
    await new Promise((done) => setTimeout(done, 350));
    await settle();
    expect(page.querySelectorAll('.unit').length).toBe(1);
    box.value = '';
    box.dispatchEvent(new Event('input'));
    await new Promise((done) => setTimeout(done, 350));
    (page.querySelector('.filters input') as HTMLInputElement).click();
    await settle();
    expect(page.querySelectorAll('.unit').length).toBe(1);
  });

  it('shows the history of the banners by date', async () => {
    (page.querySelectorAll('.tabs li')[3] as HTMLElement).click();
    await settle();
    expect(page.querySelector('.separator')?.textContent?.trim()).toBe('May 1st, 2024');
    expect(page.querySelectorAll('.unit').length).toBe(1);
  });
});
