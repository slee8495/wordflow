import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { profiles } from "@/db/schema";

// Tells the client which of three states it's in: not signed in, signed in but hasn't linked/
// created a profile yet (needs the claim-or-create onboarding step), or fully ready. Never
// accepts a client-supplied identifier — the profile (if any) is whatever's linked to the
// session's own user id.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ status: "unauthenticated" });
  }

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, session.user.id)).limit(1);
  if (!profile) {
    return NextResponse.json({ status: "needs_profile" });
  }

  return NextResponse.json({ status: "ready", name: profile.name });
}
