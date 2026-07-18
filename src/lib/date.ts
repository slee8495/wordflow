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
