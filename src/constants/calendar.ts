/**
 * Calendar-related constants
 */

/**
 * Day names starting from Saturday (for weekly meal planning)
 */
export const DAY_NAMES = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;

/**
 * Day name abbreviations
 */
export const DAY_NAMES_SHORT = [
  "Sat",
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
] as const;

/**
 * Standard day names starting from Sunday (JavaScript Date convention)
 */
export const STANDARD_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type DayName = typeof DAY_NAMES[number];
export type DayNameShort = typeof DAY_NAMES_SHORT[number];
