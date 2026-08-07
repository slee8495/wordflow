import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";
import { redeemReferral } from "@/lib/referral";
import { checkRateLimit } from "@/lib/rateLimit";

// The actual race-guarded mutation (see withReferralLock in src/lib/referral.ts) — re-validates
// everything previewReferral already checked, since state can change between a preview read and
// the accept tap.
export async function POST(req: NextRequest) {
  try {
    const profile = await requireProfile();

    const allowed = await checkRateLimit(`referral:redeem:${profile.id}`, 5, 60 * 60);
    if (!allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token : "";
    if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

    const [referred] = await db.select().from(users).where(eq(users.id, profile.userId!)).limit(1);
    if (!referred) throw new Error("linked user row not found");

    const result = await redeemReferral(referred, token);
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to redeem referral", detail: message }, { status: 500 });
  }
}
