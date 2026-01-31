/**
 * Get today's date in a specific timezone as YYYY-MM-DD
 */
export function getTodayInTimezone(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now); // Returns YYYY-MM-DD format
}

/**
 * Get the current hour (0-23) in a specific timezone
 */
export function getCurrentHourInTimezone(timezone: string): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  return parseInt(formatter.format(now), 10);
}

/**
 * Get start and end of day in a specific timezone
 */
export function getDayBoundsInTimezone(timezone: string): {
  start: Date;
  end: Date;
  todayStr: string;
} {
  const todayStr = getTodayInTimezone(timezone);

  // Create dates that represent midnight in the target timezone
  // By creating dates from the formatted string, we get the correct day boundaries
  const start = new Date(`${todayStr}T00:00:00`);
  const end = new Date(`${todayStr}T23:59:59.999`);

  return { start, end, todayStr };
}
