import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { defaultState, Result } from '../unit-search-model';
import { UnitResult } from './unit-result';

const skill = (id: string, name: string, effects: unknown[]): unknown => ({ id, name, icon: `${id}.png`, effects });

const unit = {
  id: '100000105',
  name: 'Rain',
  max_rarity: '5',
  actives: [
    skill('a1', 'Sword Slash', [
      { desc: 'Damage to one enemy', effect: { damage: { mechanism: 'physical', elements: ['fire'] } } },
      {
        desc: 'ignored',
        effect: {
          counterSkill: skill('a2', 'Counter', [{ desc: 'Counter damage' }]),
          percent: 50,
          counterType: 'physical',
        },
      },
    ]),
  ],
  passives: [skill('p1', 'Resist', [{ desc: 'Resist boost', effect: { resist: [{ name: 'fire', percent: 20 }] } }])],
  magics: [],
  lb: { name: 'Big Burst', minEffects: [{ desc: 'Min damage' }], maxEffects: [{ desc: 'Max damage' }] },
};

describe('UnitResult', () => {
  let fixture: ComponentFixture<UnitResult>;

  const render = async (): Promise<HTMLElement> => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(UnitResult);
    const result = {
      unit,
      searchData: { id: unit.id, passives: { elementalResist: { fire: 20 } } },
    } as unknown as Result;
    fixture.componentRef.setInput('result', result);
    fixture.componentRef.setInput('state', { ...defaultState(), fullyDisplayedUnits: [unit.id] });
    fixture.componentRef.setInput('itemsById', {});
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('shows the unit, its skills with their effects and the skills they use', async () => {
    const text = (await render()).textContent?.replace(/\s+/g, ' ') ?? '';
    expect(text).toContain('Rain');
    expect(text).toContain('Sword Slash');
    expect(text).toContain('Damage to one enemy');
    expect(text).toContain('50% chance to counter physical attacks with :');
    expect(text).toContain('Counter damage');
    expect(text).toContain('20%');
  });

  it('writes the resistances of an effect with pictures', async () => {
    const page = await render();
    expect(page.querySelector('.img-element-fire')).not.toBeNull();
  });
});
