import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";
import { regenerateInviteToken } from "@/lib/family";

// Owner-only. Invalidates the previous invite link — the only way to close off a leaked/
// screenshotted link, since the token is persistent and reusable by design (see joinFamily).
export async function POST() {
  try {
    const profile = await requireProfile();
    const [user] = await db.select().from(users).where(eq(users.id, profile.userId!)).limit(1);
    if (!user || user.planType !== "family") {
      return NextResponse.json({ error: "not_family_owner" }, { status: 403 });
    }

    const token = await regenerateInviteToken(user.id);
    return NextResponse.json({ token });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to regenerate invite link", detail: message }, { status: 500 });
  }
}
