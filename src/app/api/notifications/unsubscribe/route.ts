import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, pushSubscriptions } from "@/db/schema";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";

// Removes one device's subscription and, if that profile has no subscriptions left, flips
// notificationsEnabled back off.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;

  try {
    const profile = await requireProfile();

    if (endpoint) {
      await db
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.profileId, profile.id), eq(pushSubscriptions.endpoint, endpoint)));
    } else {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.profileId, profile.id));
    }

    const remaining = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.profileId, profile.id))
      .limit(1);

    if (remaining.length === 0) {
      await db.update(profiles).set({ notificationsEnabled: false }).where(eq(profiles.id, profile.id));
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to remove subscription", detail: message }, { status: 500 });
  }
}
