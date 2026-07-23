import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { profiles, type Profile } from "@/db/schema";

export class UnauthenticatedError extends Error {}
export class ProfileNotLinkedError extends Error {}

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

// Shared error->response mapping so every route doesn't hand-roll the same two status codes.
// 409 (not 401) for "not linked yet" — the caller IS authenticated, they just haven't finished
// the one-time claim-or-create-profile step yet, which the client treats as "show onboarding",
// not "log in again".
export function authErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof UnauthenticatedError) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (err instanceof ProfileNotLinkedError) {
    return NextResponse.json({ error: "profile_not_linked" }, { status: 409 });
  }
  return null;
}
