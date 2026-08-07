import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";
import { previewReferral } from "@/lib/referral";
import { checkRateLimit } from "@/lib/rateLimit";

// Sign-in-gated read before the redeem page commits to anything — lets it show a real referrer
// name or a specific reason it can't proceed (already redeemed/not a new signup/referrer's cap
// hit) instead of a bare error only surfacing after the user taps accept.
export async function GET(req: NextRequest) {
  try {
    const profile = await requireProfile();

    const allowed = await checkRateLimit(`referral:preview:${profile.id}`, 20, 60 * 60);
    if (!allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

    const [viewer] = await db.select().from(users).where(eq(users.id, profile.userId!)).limit(1);
    if (!viewer) throw new Error("linked user row not found");

    const result = await previewReferral(token, viewer);
    return NextResponse.json(result);
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to preview referral", detail: message }, { status: 500 });
  }
}
