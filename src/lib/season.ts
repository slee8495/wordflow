// Detects whether "today" (a Pacific-time YYYY-MM-DD string, matching src/lib/date.ts's
// pacificDateString) falls inside one of the app's three liturgical/holiday seasons, and which
// day within that season it is. Date arithmetic below treats the Y/M/D components as a bare
// UTC-midnight day-counter purely for day-difference math — there's no real-instant/timezone
// meaning involved, only "how many calendar days apart are these two dates."

export type Season = "holy_week" | "christmas" | "thanksgiving";
export type ActiveSeason = { season: Season; dayIndex: number };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(from: number, to: number): number {
  return Math.round((to - from) / MS_PER_DAY);
}

// Meeus/Jones/Butcher Gregorian Easter algorithm.
function computeEasterSunday(year: number): number {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(year, month - 1, day);
}

// 4th Thursday of November.
function usThanksgiving(year: number): number {
  const nov1 = Date.UTC(year, 10, 1);
  const nov1Weekday = new Date(nov1).getUTCDay(); // 0 = Sunday .. 4 = Thursday
  const firstThursday = 1 + ((4 - nov1Weekday + 7) % 7);
  return Date.UTC(year, 10, firstThursday + 21);
}

export function getActiveSeason(pacificDate: string): ActiveSeason | null {
  const [year, month, day] = pacificDate.split("-").map(Number);
  const today = Date.UTC(year, month - 1, day);

  // Holy Week: Palm Sunday (Easter - 7) through Easter Sunday, 8 days (dayIndex 0-7). Checked
  // against both this year's and last year's Easter so the window works correctly in
  // January when "this year's" Easter hasn't happened yet but isn't needed anyway.
  for (const easterYear of [year, year - 1]) {
    const easter = computeEasterSunday(easterYear);
    const palmSunday = easter - 7 * MS_PER_DAY;
    const holyWeekDay = daysBetween(palmSunday, today);
    if (holyWeekDay >= 0 && holyWeekDay <= 7) return { season: "holy_week", dayIndex: holyWeekDay };
  }

  // Christmas: Dec 19-25, 7 days (dayIndex 0-6).
  if (month === 12 && day >= 19 && day <= 25) {
    return { season: "christmas", dayIndex: day - 19 };
  }

  // Thanksgiving: Tue/Wed/Thu of Thanksgiving week, 3 days (dayIndex 0-2).
  const thanksgiving = usThanksgiving(year);
  const tuesday = thanksgiving - 2 * MS_PER_DAY;
  const thanksgivingDay = daysBetween(tuesday, today);
  if (thanksgivingDay >= 0 && thanksgivingDay <= 2) return { season: "thanksgiving", dayIndex: thanksgivingDay };

  return null;
}
