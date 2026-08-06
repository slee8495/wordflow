import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";
import { previewInvite } from "@/lib/family";
import { checkRateLimit } from "@/lib/rateLimit";

// Sign-in-gated (not fully public) read before the join page commits to anything — lets it show
// a real owner name or a specific reason it can't proceed (full/already a member/is the owner)
// instead of a bare error only surfacing after the user taps accept.
export async function GET(req: NextRequest) {
  try {
    const profile = await requireProfile();

    const allowed = await checkRateLimit(`family:preview:${profile.id}`, 20, 60 * 60);
    if (!allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

    const result = await previewInvite(token, profile.userId!);
    return NextResponse.json(result);
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to preview invite", detail: message }, { status: 500 });
  }
}
