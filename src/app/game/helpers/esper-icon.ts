import { escapeName } from './item';

/** The file name of the picture of an Esper at a rarity (`Siren_2`; the Black Dragon is `Kokuryu`). */
export function esperPicture(name: string, rarity: number): string {
  const escaped = escapeName(name);
  return `${escaped === 'Black_Dragon' ? 'Kokuryu' : escaped}_${rarity}`;
}

/** The icon of an Esper at a rarity (1 to 3 stars). */
export const esperIcon = (name: string, rarity: number): string => `esper-${esperPicture(name, rarity)}`;
