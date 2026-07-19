// "Today" as a plain YYYY-MM-DD string, in California time — the day boundary for
// readings.forDate and deep_reading_logs.forDate. Was UTC-based before, which flipped the day
// ~5-6pm Pacific (UTC midnight) instead of at actual Pacific midnight, so the "today's reading"
// would advance to the next curriculum entry while it was still evening in California.
export function todayDateString(): string {
  return pacificDateString();
}

// Pacific-time calendar date, offset by `offsetDays` (negative for the past).
export function pacificDateString(offsetDays = 0): string {
  const target = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(target);
}

// Current hour in Pacific time (0-23), DST-aware — used by the morning-reminder cron to detect
// "is it actually 5am in California right now" without depending on a fixed UTC cron offset that
// would drift an hour twice a year across DST transitions.
export function pacificHour(): number {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  // "24" shows up for midnight in some environments' hour12:false output — normalize to 0.
  return Number(hourStr) % 24;
}
