/** The sexes an item can be limited to (`exclusiveSex`). */
export const sexList = ['female', 'male'] as const;

/** The roles of a unit (`roles`), and the roles an item can be limited to (`exclusiveRoles`). */
export const roleList = [
  'physicalAttacker',
  'magicalAttacker',
  'physicalTank',
  'magicalTank',
  'healer',
  'support',
  'debuffer',
] as const;

export type Sex = (typeof sexList)[number];
export type Role = (typeof roleList)[number];

/** Who can equip an item: the sexes first, then the roles (the order of the filters and of the icons). */
export const restrictionList: readonly string[] = [...sexList, ...roleList];
