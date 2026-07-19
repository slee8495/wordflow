import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, pushSubscriptions } from "@/db/schema";
import { findOrCreateProfile } from "@/lib/generateReading";

function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Saves (or refreshes) a browser's push subscription for a profile and turns notifications on.
// A profile can have more than one subscription — each device that opts in gets its own row.
// Also captures whatever timezone/uiLang/notificationHour the client currently has, so the very
// first subscribe already has everything the cron needs instead of waiting on a later sync.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = body?.name?.trim();
  const subscription = body?.subscription;
  const uiLang = body?.uiLang === "ko" ? "ko" : body?.uiLang === "en" ? "en" : undefined;
  const timezone = isValidTimezone(body?.timezone) ? body.timezone : undefined;
  const notificationHour =
    typeof body?.notificationHour === "number" && body.notificationHour >= 0 && body.notificationHour <= 23
      ? body.notificationHour
      : undefined;
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;

  if (!name || !endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "name and a valid subscription are required" }, { status: 400 });
  }

  try {
    const profile = await findOrCreateProfile(name);

    await db
      .insert(pushSubscriptions)
      .values({ profileId: profile.id, endpoint, p256dh, auth })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { profileId: profile.id, p256dh, auth },
      });

    await db
      .update(profiles)
      .set({
        notificationsEnabled: true,
        ...(uiLang ? { uiLang } : {}),
        ...(timezone ? { timezone } : {}),
        ...(notificationHour !== undefined ? { notificationHour } : {}),
      })
      .where(eq(profiles.id, profile.id));

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to save subscription", detail: message }, { status: 500 });
  }
}
