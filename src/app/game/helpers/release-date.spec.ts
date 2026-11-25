import { releaseDate } from './release-date';

describe('releaseDate', () => {
  it('writes the year, the month name and the day', () => {
    expect(releaseDate('October the 27th, 2022')).toBe('2022 October 27th');
    expect(releaseDate('August 8th, 2024')).toBe('2024 August 8th');
    expect(releaseDate('March the 03rd, 2022')).toBe('2022 March 3rd');
  });

  it('reads the typos and the spaces of the data', () => {
    expect(releaseDate('Febuary the 01st, 2018')).toBe('2018 February 1st');
    expect(releaseDate('April the 17h, 2020')).toBe('2020 April 17th');
    expect(releaseDate(' September the 15th, 2017')).toBe('2017 September 15th');
  });

  it('uses 11th, 12th, 13th and 22nd', () => {
    expect(releaseDate('June 11th, 2023')).toBe('2023 June 11th');
    expect(releaseDate('June the 22nd, 2023')).toBe('2023 June 22nd');
    expect(releaseDate('June 13th, 2023')).toBe('2023 June 13th');
  });

  it('keeps a text that is not a date', () => {
    expect(releaseDate('soon')).toBe('soon');
  });
});
