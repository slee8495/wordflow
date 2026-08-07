import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";
import { regenerateReferralToken } from "@/lib/referral";

// Eligible-referrer-only. Invalidates the previous referral link.
export async function POST() {
  try {
    const profile = await requireProfile();
    const [user] = await db.select().from(users).where(eq(users.id, profile.userId!)).limit(1);
    if (!user || !(user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing")) {
      return NextResponse.json({ error: "not_eligible_referrer" }, { status: 403 });
    }

    const token = await regenerateReferralToken(user.id);
    return NextResponse.json({ token });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to regenerate referral link", detail: message }, { status: 500 });
  }
}
