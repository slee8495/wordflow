import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";

// Updates just the notification hour (0-23, in the profile's own timezone) for a profile that's
// already subscribed — lets Settings change "what time" without re-running the whole permission/
// subscribe flow. Timezone itself is kept in sync separately by ProfileSettingsSync.tsx.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const notificationHour = body?.notificationHour;

  if (typeof notificationHour !== "number" || notificationHour < 0 || notificationHour > 23) {
    return NextResponse.json({ error: "a notificationHour (0-23) is required" }, { status: 400 });
  }

  try {
    const profile = await requireProfile();
    await db.update(profiles).set({ notificationHour }).where(eq(profiles.id, profile.id));
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    throw err;
  }
}
