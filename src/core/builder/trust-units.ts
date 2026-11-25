/** The id of a unit without the `jp-` of its Japan version (the TMR and the STMR are of the unit the version is of). */
const withoutJp = (id: string): string => id.replace(/^jp-/, '');

/**
 * The ids of the units whose TMR and STMR a unit can use: its own (its Japan version has the ones of the unit it is a
 * version of) and those of its other Brave Shift form, which are shared.
 */
export function trustUnitIds(unit: { id: string; braveShift?: string; braveShifted?: string }): { own: string[]; other: string[] } {
  const forms = (id: string): string[] => [...new Set([id, withoutJp(id)])];
  const other = unit.braveShift ?? unit.braveShifted;
  return { own: forms(unit.id), other: other ? forms(other) : [] };
}
