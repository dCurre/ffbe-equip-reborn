import { GameServer } from '../services/server-context';

const WIKI = 'https://exvius.fandom.com/wiki/';

/** The wiki page of a unit, item or skill (`page` defaults to `name`); the JP data has `/JP` pages. */
export function wikiUrl(name: string, server: GameServer): string {
  let link = WIKI + encodeURIComponent(name.replace(/ /g, '_'));
  if (link.includes('_BS')) link = link.replace('_BS', '#Brave_Shift');
  return server === 'JP' ? `${link}/JP` : link;
}
