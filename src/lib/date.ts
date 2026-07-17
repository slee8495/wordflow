// "Today" as a plain YYYY-MM-DD string. Deliberately simple (UTC-based) for now — revisit if
// the day boundary needs to line up with a specific timezone once this has real daily users.
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Pacific-time calendar date, offset by `offsetDays` — used for the Reading tab's projected
// completion date, which is explicitly meant to track California time regardless of where the
// app is deployed. todayDateString() above stays UTC-based for row bucketing (readings.forDate,
// deep_reading_logs.forDate) — this is a display-only helper, not a day-boundary change.
export function pacificDateString(offsetDays = 0): string {
  const target = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(target);
}
