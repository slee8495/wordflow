import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import { hasActiveAccess } from "@/lib/entitlement";

// Tells the client which of three states it's in: not signed in, signed in but hasn't linked/
// created a profile yet (needs the claim-or-create onboarding step), or fully ready. Never
// accepts a client-supplied identifier — the profile (if any) is whatever's linked to the
// session's own user id. When ready, also reports billing/comp status (see
// src/lib/entitlement.ts) so the client can show a paywall or the Settings "Plan" section
// without a second round trip.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ status: "unauthenticated" });
  }

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, session.user.id)).limit(1);
  if (!profile) {
    return NextResponse.json({ status: "needs_profile" });
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  const plan = {
    hasAccess: user ? hasActiveAccess(user) : false,
    subscriptionStatus: user?.subscriptionStatus ?? null,
    currentPeriodEnd: user?.currentPeriodEnd?.toISOString() ?? null,
    compFreeForever: user?.compFreeForever ?? false,
    compFreeUntil: user?.compFreeUntil ?? null,
  };

  return NextResponse.json({
    status: "ready",
    name: profile.name,
    plan,
    readingBookmark: profile.readingBookmark,
    todayBookmark: profile.todayBookmark,
  });
}
