import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { profiles, users, type Profile } from "@/db/schema";
import { hasActiveAccess } from "@/lib/entitlement";

export class UnauthenticatedError extends Error {}
export class ProfileNotLinkedError extends Error {}
export class PaymentRequiredError extends Error {}

// The server-side counterpart to the old client-supplied `name` query/body param — every route
// that used to call findOrCreateProfile(name) (trusting whatever name a request happened to
// include) now calls this instead, so a request can only ever act on the profile actually linked
// to the caller's signed-in Google account (profiles.userId), never an arbitrary name someone
// else typed into a query string. That gap — anyone could pass `?name=slee` and read/advance
// slee's reading progress — is exactly what moving to real auth is meant to close.
export async function requireProfile(): Promise<Profile> {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthenticatedError("not signed in");

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, session.user.id)).limit(1);
  if (!profile) throw new ProfileNotLinkedError("signed in but no profile linked yet");
  return profile;
}

// Same as requireProfile(), but also requires an active subscription or comp grant (see
// src/lib/entitlement.ts) — used by every route that serves or generates paid content (Today's
// daily reading, Reading's book/chapter browser). Routes a signed-in-but-not-yet-paying user
// still needs to reach (billing checkout, profile settings, etc.) should keep using
// requireProfile() instead.
export async function requireEntitledProfile(): Promise<Profile> {
  const profile = await requireProfile();
  const [user] = await db.select().from(users).where(eq(users.id, profile.userId!)).limit(1);
  if (!user || !hasActiveAccess(user)) throw new PaymentRequiredError("no active subscription");
  return profile;
}

// Shared error->response mapping so every route doesn't hand-roll the same status codes.
// 409 (not 401) for "not linked yet" — the caller IS authenticated, they just haven't finished
// the one-time claim-or-create-profile step yet, which the client treats as "show onboarding",
// not "log in again". 402 for "linked but not entitled" — the client treats that as "show the
// paywall", distinct from both of the above.
export function authErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof UnauthenticatedError) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (err instanceof ProfileNotLinkedError) {
    return NextResponse.json({ error: "profile_not_linked" }, { status: 409 });
  }
  if (err instanceof PaymentRequiredError) {
    return NextResponse.json({ error: "payment_required" }, { status: 402 });
  }
  return null;
}
