import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { DungeonMonsters, Monster } from '../bestiary-model';
import { MissionMonsters } from './mission-monsters';

const monster = (name: string, race: string): Monster => ({
  name,
  hp: 1,
  atk: 1,
  def: 1,
  mag: 1,
  spr: 1,
  races: [race],
  traits: { break: [race === 'human' ? 'atk' : 'def'] },
  source: 'table',
});

describe('MissionMonsters', () => {
  it('sends to the Builder a monster with resistances and no stats, not one with nothing', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const noStats = { atk: null, def: null, mag: null, spr: null };
    const data: DungeonMonsters = {
      monsters: [
        { ...monster('Anima', 'undead'), ...noStats },
        { ...monster('Shade', 'undead'), ...noStats, traits: {} },
      ],
      missions: { 1: [0, 1] },
    };
    const fixture = TestBed.createComponent(MissionMonsters);
    fixture.componentRef.setInput('data', data);
    fixture.componentRef.setInput('mission', 1);
    await fixture.whenStable();
    const links = [...fixture.nativeElement.querySelectorAll('a.to-builder')] as HTMLElement[];
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([expect.stringContaining('Anima')]);
    expect(links[0].title).toContain('not published');
  });

  it('draws the monsters of another stage without the track warning of Angular', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const data: DungeonMonsters = {
      monsters: [monster('Knight', 'human'), monster('Wolf', 'beast')],
      missions: { 1: [0], 2: [1] },
    };
    const warn = vi.spyOn(console, 'warn');
    const fixture = TestBed.createComponent(MissionMonsters);
    fixture.componentRef.setInput('data', data);
    fixture.componentRef.setInput('mission', 1);
    await fixture.whenStable();
    fixture.componentRef.setInput('mission', 2);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Wolf');
    expect(warn.mock.calls.flat().filter((message) => String(message).includes('NG0956'))).toEqual([]);
    warn.mockRestore();
  });
});
