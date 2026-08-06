import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";
import { removeFamilyMember } from "@/lib/family";

// Owner removing one of their members, or a member removing themselves ("leave") — one endpoint,
// authorized either way inside removeFamilyMember. No rate limit: a delete can't be abused to
// exceed the family's capacity the way join can. memberUserId defaults to the caller's own id
// when omitted — the client never needs to know its own raw users.id just to leave a family.
export async function POST(req: NextRequest) {
  try {
    const profile = await requireProfile();

    const body = await req.json().catch(() => null);
    const memberUserId = typeof body?.memberUserId === "string" ? body.memberUserId : profile.userId!;

    const removed = await removeFamilyMember(profile.userId!, memberUserId);
    if (!removed) return NextResponse.json({ error: "not_authorized_or_not_found" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to remove family member", detail: message }, { status: 500 });
  }
}
