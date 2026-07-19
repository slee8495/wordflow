import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";

function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Best-effort sync of the client's UI-language and timezone settings onto the profile row, so
// server-side code with no request/session context (the morning-reminder cron) can still compose
// text in the right language and know the profile's own day boundary. Fire-and-forget from the
// client — never blocks or surfaces errors to the user. Either field is optional per-call so this
// can be used to update just one of them.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = body?.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const update: { uiLang?: "ko" | "en"; timezone?: string } = {};
  if (body?.uiLang === "ko" || body?.uiLang === "en") update.uiLang = body.uiLang;
  if (isValidTimezone(body?.timezone)) update.timezone = body.timezone;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "at least one of uiLang/timezone is required" }, { status: 400 });
  }

  await db.update(profiles).set(update).where(eq(profiles.name, name));
  return NextResponse.json({ status: "ok" });
}
