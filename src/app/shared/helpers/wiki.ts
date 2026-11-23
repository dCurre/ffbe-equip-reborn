const WIKI = 'https://exvius.fandom.com/wiki/';
const JP_TAG = ' [JP]';

/** The wiki page of a unit, item or skill; a name ending with " [JP]" is a unit of the Japan version (the `/JP` page). */
export function wikiUrl(name: string): string {
  const jp = name.endsWith(JP_TAG);
  const link = WIKI + encodeURIComponent((jp ? name.slice(0, -JP_TAG.length) : name).replace(/ /g, '_')).replace('_BS', '#Brave_Shift');
  return jp ? link.replace(/(#|$)/, '/JP$1') : link;
}
