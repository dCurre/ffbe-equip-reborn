/** What a search reads of a unit: its name and its Japanese name (`jpname`), which is never shown. */
export const searchName = (unit: { name: string; jpname?: string }): string =>
  unit.jpname ? `${unit.name}|${unit.jpname}` : unit.name;
