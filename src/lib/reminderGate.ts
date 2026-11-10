import { del, get, put } from "@vercel/blob";
import { dateStringInTimezone, hourInTimezone } from "./date";

// The morning-reminder cron is pinged every 15 minutes (GitHub Actions) and used to open the
// database every time. Neon sleeps after 5 quiet minutes, so it was woken four times an hour,
// all day — compute billed for hours when nobody was being reminded (2026-11).
//
// The reminder only goes out once a day per profile, at that profile's own local hour. So the
// cron keeps a tiny copy of "who is due when" here, outside the DB, and opens the DB only when
// one of those hours has arrived and that profile hasn't been reminded today yet.
//
// The cron rewrites the copy every time it does open the DB. Anything that changes who is due
// when (turning reminders on, changing the hour, a new timezone) drops the copy, so the next ping
// reads the DB. As a backstop the copy is also ignored once it is older than MAX_AGE_MS.

const PATH = "reminder/gate.json";
const MAX_AGE_MS = 6 * 60 * 60_000;

export type GateEntry = { tz: string; hour: number; last: string | null };
export type Gate = { builtAt: number; entries: GateEntry[] };

export async function readGate(): Promise<Gate | null> {
  try {
    const res = await get(PATH, { access: "private" });
    if (!res || res.statusCode !== 200) return null;
    return JSON.parse(await new Response(res.stream).text()) as Gate;
  } catch {
    return null; // no copy or store unreachable → read the DB, which is always correct
  }
}

export async function writeGate(entries: GateEntry[]) {
  try {
    await put(PATH, JSON.stringify({ builtAt: Date.now(), entries } satisfies Gate), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
  } catch {
    // Without a copy the cron just reads the DB next time.
  }
}

export async function dropGate() {
  try {
    await del(PATH);
  } catch {
    // Nothing to drop.
  }
}

/** Does this ping need the DB? Only if someone's reminder hour is now and they weren't reminded today. */
export function gateSaysCheck(gate: Gate, now = Date.now()): boolean {
  if (now - gate.builtAt > MAX_AGE_MS) return true;
  return gate.entries.some((e) => hourInTimezone(e.tz) === e.hour && dateStringInTimezone(e.tz) !== e.last);
}
