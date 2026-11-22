import { candidateUnits } from './param-challenge';

/* eslint-disable @typescript-eslint/no-explicit-any -- test data */

const unit = (hp: number): any => ({ stats: { maxStats: { hp }, pots: { hp: 0 } } });
const units: Record<string, any> = {
  '100000105': unit(5000),
  '100000205': unit(9000),
  '100000305': { ...unit(1000), '6_form': unit(7000) },
  '100000404': unit(8000),
};
const owned: any = {
  '100000105': { number: 0, sevenStar: 1 },
  '100000205': { number: 2 },
  '100000305': { number: 1 },
  '100000404': { number: 1 },
};

describe('candidateUnits', () => {
  it('keeps the 7★ units, the strongest first', () => {
    expect(candidateUnits('hp', 'sevenStar', owned, units)).toEqual(['100000105']);
  });

  it('adds the units with two 5★ copies as potential 7★', () => {
    expect(candidateUnits('hp', 'potentialSevenStar', owned, units)).toEqual(['100000205', '100000105']);
  });

  it('tries the rainbows that are not 7★ in their 6★ form', () => {
    expect(candidateUnits('hp', 'rainbows', owned, units)).toEqual(['100000205', '100000305-6', '100000105']);
  });
});
