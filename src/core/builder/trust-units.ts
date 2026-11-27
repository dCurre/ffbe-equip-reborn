/**
 * The ids of the units whose TMR and STMR a unit can use: its own (its Japan version has the ones of the unit it is a
 * version of) and those of its other Brave Shift form, which are shared.
 */
export function trustUnitIds(unit: { id: string; variantOf?: string; braveShift?: string; braveShifted?: string }): {
  own: string[];
  other: string[];
} {
  // a version also has the TMR and STMR of the Global unit it is a version of (`variantOf`); its other Brave Shift form is
  // the one with the same last two digits there (the id may differ from its own: Japan numbers some units differently)
  const forms = (id: string): string[] =>
    unit.variantOf ? [...new Set([id, unit.variantOf.slice(0, -2) + id.slice(-2)])] : [id];
  const other = unit.braveShift ?? unit.braveShifted;
  return { own: forms(unit.id), other: other ? forms(other) : [] };
}
