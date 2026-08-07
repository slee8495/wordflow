import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { referralGrants, users } from "@/db/schema";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";
import { MAX_REFERRALS, getOrCreateReferralToken } from "@/lib/referral";

// Eligible-referrer-only: the invite link (lazily generated on first request) and how many of
// the 3 gift slots have been used.
export async function GET(req: NextRequest) {
  try {
    const profile = await requireProfile();
    const [user] = await db.select().from(users).where(eq(users.id, profile.userId!)).limit(1);
    if (!user || !(user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing")) {
      return NextResponse.json({ error: "not_eligible_referrer" }, { status: 403 });
    }

    const token = await getOrCreateReferralToken(user.id);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(referralGrants)
      .where(eq(referralGrants.referrerUserId, user.id));

    return NextResponse.json({
      inviteUrl: `${req.nextUrl.origin}/referral/${token}`,
      slotsUsed: count,
      slotsTotal: MAX_REFERRALS,
    });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to load referral invite", detail: message }, { status: 500 });
  }
}
