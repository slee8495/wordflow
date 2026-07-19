// "Today" as a plain YYYY-MM-DD string, computed in a given IANA timezone — the day boundary for
// readings.forDate, deep_reading_logs.forDate, season detection, and progress-stat windows.
// Every profile carries its own timezone (profiles.timezone, synced from the browser — see
// ProfileSettingsSync.tsx); DEFAULT_TIMEZONE is only the fallback for a profile that predates
// that column or hasn't synced one yet, preserving the app's original hardcoded-Pacific behavior
// for those rows instead of silently changing their day boundary.
export const DEFAULT_TIMEZONE = "America/Los_Angeles";
export const DEFAULT_NOTIFICATION_HOUR = 5;

// Calendar date in the given IANA timezone, offset by `offsetDays` (negative for the past).
export function dateStringInTimezone(timezone: string, offsetDays = 0): string {
  const target = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(target);
}

// Current hour (0-23) in the given IANA timezone, DST-aware — used by the morning-reminder cron
// to detect "is it actually this profile's chosen hour right now" without depending on a fixed
// UTC offset that would drift across DST transitions or vary by timezone.
export function hourInTimezone(timezone: string): number {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  // "24" shows up for midnight in some environments' hour12:false output — normalize to 0.
  return Number(hourStr) % 24;
}

// Convenience wrappers for the common case: a DB row with a possibly-null `timezone` field,
// resolved against DEFAULT_TIMEZONE. Every call site that has a Profile in scope should use
// these instead of calling dateStringInTimezone/hourInTimezone with a manually-resolved zone.
export function profileDateString(profile: { timezone: string | null }, offsetDays = 0): string {
  return dateStringInTimezone(profile.timezone ?? DEFAULT_TIMEZONE, offsetDays);
}

export function profileHour(profile: { timezone: string | null }): number {
  return hourInTimezone(profile.timezone ?? DEFAULT_TIMEZONE);
}
