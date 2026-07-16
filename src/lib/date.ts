// "Today" as a plain YYYY-MM-DD string. Deliberately simple (UTC-based) for now — revisit if
// the day boundary needs to line up with a specific timezone once this has real daily users.
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
