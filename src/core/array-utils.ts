/** True if the two arrays share at least one value. */
export function matches(array1: any[], array2: any[]): boolean {
  return Array.from(array1 ?? []).some((value) => array2.includes(value));
}

/** True if array1 contains every value of array2. */
export function includeAll(array1: any[], array2: any[]): boolean {
  return Array.from(array2 ?? []).every((value) => array1.includes(value));
}
