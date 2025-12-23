/**
 * Shared date utility functions
 */

/**
 * Format a Date object as YYYY-MM-DD in local timezone (not UTC)
 */
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get the next Saturday from today
 * If today is Saturday, returns next Saturday (7 days away)
 */
export function getNextSaturday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday

  // Calculate days until next Saturday
  // If today is Saturday, return next Saturday (7 days)
  // If today is Sunday (0), next Saturday is 6 days away
  // If today is Monday (1), next Saturday is 5 days away, etc.
  const daysUntilSaturday = dayOfWeek === 6 ? 7 : (6 - dayOfWeek + 7) % 7 || 7;

  const nextSaturday = new Date(today);
  nextSaturday.setDate(today.getDate() + daysUntilSaturday);
  return formatDateLocal(nextSaturday);
}

/**
 * Get Saturday options for week selection
 * Returns array of YYYY-MM-DD strings starting from last Saturday
 */
export function getSaturdayOptions(count: number = 8): string[] {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday

  // Calculate days since last Saturday
  const daysToLastSaturday = dayOfWeek === 6 ? 7 : dayOfWeek + 1;

  const lastSaturday = new Date(today);
  lastSaturday.setDate(today.getDate() - daysToLastSaturday);

  const saturdays: string[] = [];

  for (let i = 0; i < count; i++) {
    const saturday = new Date(lastSaturday);
    saturday.setDate(lastSaturday.getDate() + i * 7);
    saturdays.push(formatDateLocal(saturday));
  }

  return saturdays;
}

/**
 * Get array of dates for a week starting from a Saturday
 */
export function getWeekDates(saturdayDate: string): Date[] {
  const start = new Date(saturdayDate + "T00:00:00");
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date);
  }
  return dates;
}

/**
 * Format a week range for display (e.g., "Dec 21 - Dec 27, 2024")
 */
export function formatWeekRange(saturdayDateStr: string): string {
  const date = new Date(saturdayDateStr + "T00:00:00");
  const endDate = new Date(date);
  endDate.setDate(date.getDate() + 6);

  const startLabel = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endLabel = endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startLabel} - ${endLabel}`;
}

/**
 * Check if a date string represents the current week
 */
export function isCurrentWeek(weekOf: string): boolean {
  const today = new Date();
  const weekStart = new Date(weekOf + "T00:00:00");
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return today >= weekStart && today <= weekEnd;
}

/**
 * Parse a date string and return a Date object at midnight local time
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00");
}
