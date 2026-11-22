/** The tone of a field of the enemy: `buff` (green) when the value protects the enemy, `debuff` (red) when it weakens it. */
export function fieldTone(text: string | undefined, higherIsBuff: boolean): string {
  const value = parseInt(text ?? '', 10);
  if (!value) return '';
  return value > 0 === higherIsBuff ? 'buff' : 'debuff';
}
