import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { profiles } from "@/db/schema";

// One-time onboarding step after a first Google sign-in: either attaches this account to an
// existing pre-auth profile by name (so a family member's reading progress carries over) or
// creates a brand-new one. Deliberately just a typed name, not a picker over every unclaimed
// profile — this repo is mid-transition from a handful of real family profiles to a public
// launch, and listing every name for anyone to browse/claim would leak more than it's worth at
// this stage. Once a name is claimed it can never be claimed by a different account again (the
// `isNull(userId)` guard below), so the actual exposure is a narrow one-time window, not an
// ongoing hole — worth tightening further (e.g. an out-of-band confirmation) before a wider
// public launch, but reasonable for now.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const [alreadyLinked] = await db.select().from(profiles).where(eq(profiles.userId, session.user.id)).limit(1);
  if (alreadyLinked) {
    return NextResponse.json({ error: "already_linked", name: alreadyLinked.name }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 64) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  // Try claiming an existing, not-yet-linked profile with this exact name first.
  const [claimed] = await db
    .update(profiles)
    .set({ userId: session.user.id })
    .where(and(eq(profiles.name, name), isNull(profiles.userId)))
    .returning();
  if (claimed) {
    return NextResponse.json({ status: "ready", name: claimed.name });
  }

  // No unclaimed profile with that name — either it doesn't exist yet (create it) or it's
  // already linked to a different account (name_taken).
  const [existing] = await db.select().from(profiles).where(eq(profiles.name, name)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "name_taken" }, { status: 409 });
  }

  const [created] = await db
    .insert(profiles)
    .values({ name, userId: session.user.id })
    .onConflictDoNothing({ target: profiles.name })
    .returning();
  if (created) {
    return NextResponse.json({ status: "ready", name: created.name });
  }

  // Lost a race against a concurrent create/claim of the same name.
  return NextResponse.json({ error: "name_taken" }, { status: 409 });
}
