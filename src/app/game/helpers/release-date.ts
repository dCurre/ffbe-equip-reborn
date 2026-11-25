const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th, 21st. */
const ordinal = (day: number): string =>
  `${day}${['th', 'st', 'nd', 'rd'][day % 100 >= 11 && day % 100 <= 13 ? 0 : day % 10] ?? 'th'}`;

/**
 * A release date of the data as year, month name, day: "October the 27th, 2022" and "August 8th, 2024" are "2022 October 27th" and
 * "2024 August 8th". The data has typos ("Febuary", "17h") and spaces, so the month is found by its first three letters.
 * A text that is not a date stays as it is.
 */
export function releaseDate(text: string): string {
  const match = /^\s*([A-Za-z]+)(?:\s+the)?\s+(\d{1,2})\w*,?\s+(\d{4})/.exec(text);
  const month = MONTHS.find((name) => name.slice(0, 3).toLowerCase() === match?.[1].slice(0, 3).toLowerCase());
  return match && month ? `${match[3]} ${month} ${ordinal(Number(match[2]))}` : text;
}
