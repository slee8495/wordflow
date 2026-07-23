import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";

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
// can be used to update just one of them. A no-op (not an error) if this is called before the
// profile-claim onboarding step has happened yet, since ProfileSettingsSync fires on every
// uiLang/timezone change regardless of auth state.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const update: { uiLang?: "ko" | "en"; timezone?: string } = {};
  if (body?.uiLang === "ko" || body?.uiLang === "en") update.uiLang = body.uiLang;
  if (isValidTimezone(body?.timezone)) update.timezone = body.timezone;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "at least one of uiLang/timezone is required" }, { status: 400 });
  }

  try {
    const profile = await requireProfile();
    await db.update(profiles).set(update).where(eq(profiles.id, profile.id));
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return NextResponse.json({ status: "ok" });
    throw err;
  }
}
