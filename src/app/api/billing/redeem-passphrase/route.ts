import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";
import { checkRateLimit } from "@/lib/rateLimit";

// One-time redemption of the shared family passphrase, granting permanent free access
// (users.compFreeForever) independent of Stripe. Not a real security boundary (it's a shared
// family secret, not a per-person code) — a plain equality check is fine here.
export async function POST(req: NextRequest) {
  try {
    const profile = await requireProfile();

    // A legitimate attempt takes 1-2 tries; this only exists to stop someone signed in from
    // scripting guesses against the shared passphrase.
    const allowed = await checkRateLimit(`passphrase:${profile.id}`, 5, 60 * 60);
    if (!allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const passphrase = typeof body?.passphrase === "string" ? body.passphrase : "";

    if (!passphrase || passphrase !== process.env.FAMILY_PASSPHRASE) {
      return NextResponse.json({ error: "invalid_passphrase" }, { status: 400 });
    }

    await db.update(users).set({ compFreeForever: true }).where(eq(users.id, profile.userId!));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to redeem passphrase", detail: message }, { status: 500 });
  }
}
