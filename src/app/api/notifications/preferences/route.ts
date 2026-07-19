import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";

// Updates just the notification hour (0-23, in the profile's own timezone) for a profile that's
// already subscribed — lets Settings change "what time" without re-running the whole permission/
// subscribe flow. Timezone itself is kept in sync separately by ProfileSettingsSync.tsx.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = body?.name?.trim();
  const notificationHour = body?.notificationHour;

  if (!name || typeof notificationHour !== "number" || notificationHour < 0 || notificationHour > 23) {
    return NextResponse.json({ error: "name and a notificationHour (0-23) are required" }, { status: 400 });
  }

  await db.update(profiles).set({ notificationHour }).where(eq(profiles.name, name));
  return NextResponse.json({ status: "ok" });
}
