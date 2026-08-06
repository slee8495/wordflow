import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";
import { joinFamily } from "@/lib/family";
import { checkRateLimit } from "@/lib/rateLimit";

// The actual race-guarded mutation (see withFamilyLock in src/lib/family.ts) — re-validates
// everything previewInvite already checked, since state can change between a preview read and
// the accept tap.
export async function POST(req: NextRequest) {
  try {
    const profile = await requireProfile();

    const allowed = await checkRateLimit(`family:join:${profile.id}`, 5, 60 * 60);
    if (!allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token : "";
    if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

    const result = await joinFamily(profile.userId!, token);
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to join family plan", detail: message }, { status: 500 });
  }
}
