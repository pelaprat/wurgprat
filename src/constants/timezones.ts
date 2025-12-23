/**
 * Timezone constants for settings
 */

export interface TimezoneOption {
  value: string;
  label: string;
}

export interface TimezoneGroup {
  group: string;
  timezones: TimezoneOption[];
}

/**
 * Common timezones grouped by region
 */
export const TIMEZONE_OPTIONS: TimezoneGroup[] = [
  {
    group: "US & Canada",
    timezones: [
      { value: "America/New_York", label: "Eastern Time (ET)" },
      { value: "America/Chicago", label: "Central Time (CT)" },
      { value: "America/Denver", label: "Mountain Time (MT)" },
      { value: "America/Phoenix", label: "Arizona (MST)" },
      { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
      { value: "America/Anchorage", label: "Alaska Time" },
      { value: "Pacific/Honolulu", label: "Hawaii Time" },
    ],
  },
  {
    group: "Europe",
    timezones: [
      { value: "Europe/London", label: "London (GMT/BST)" },
      { value: "Europe/Paris", label: "Paris (CET)" },
      { value: "Europe/Berlin", label: "Berlin (CET)" },
      { value: "Europe/Amsterdam", label: "Amsterdam (CET)" },
      { value: "Europe/Rome", label: "Rome (CET)" },
      { value: "Europe/Madrid", label: "Madrid (CET)" },
    ],
  },
  {
    group: "Asia & Pacific",
    timezones: [
      { value: "Asia/Tokyo", label: "Tokyo (JST)" },
      { value: "Asia/Shanghai", label: "Shanghai (CST)" },
      { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
      { value: "Asia/Singapore", label: "Singapore (SGT)" },
      { value: "Asia/Seoul", label: "Seoul (KST)" },
      { value: "Australia/Sydney", label: "Sydney (AEST)" },
      { value: "Australia/Melbourne", label: "Melbourne (AEST)" },
      { value: "Pacific/Auckland", label: "Auckland (NZST)" },
    ],
  },
  {
    group: "Other",
    timezones: [{ value: "UTC", label: "UTC" }],
  },
];

/**
 * Get the browser's timezone or a sensible default
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/**
 * Check if a timezone string is valid
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
