import { wikiUrl } from './wiki';

describe('wikiUrl', () => {
  it('links the page of a name, and the Brave Shift section of a BS unit', () => {
    expect(wikiUrl('Black Mage Vivi')).toBe('https://exvius.fandom.com/wiki/Black_Mage_Vivi');
    expect(wikiUrl('Rain BS')).toBe('https://exvius.fandom.com/wiki/Rain#Brave_Shift');
  });

  it('links the /JP page of a unit of the Japan version', () => {
    expect(wikiUrl('Rain [JP]')).toBe('https://exvius.fandom.com/wiki/Rain/JP');
    expect(wikiUrl('Rain BS [JP]')).toBe('https://exvius.fandom.com/wiki/Rain/JP#Brave_Shift');
  });
});
