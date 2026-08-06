import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { familyMemberships, users } from "@/db/schema";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";
import { MAX_FAMILY_MEMBERS, getOrCreateInviteToken } from "@/lib/family";

// Owner-only: the invite link (lazily generated on first request), current member list, and
// slots used/remaining — everything the Settings "family plan" panel needs in one call.
export async function GET(req: NextRequest) {
  try {
    const profile = await requireProfile();
    const [user] = await db.select().from(users).where(eq(users.id, profile.userId!)).limit(1);
    if (!user || user.planType !== "family") {
      return NextResponse.json({ error: "not_family_owner" }, { status: 403 });
    }

    const token = await getOrCreateInviteToken(user.id);
    const members = await db
      .select({ id: users.id, name: users.name, joinedAt: familyMemberships.joinedAt })
      .from(familyMemberships)
      .innerJoin(users, eq(users.id, familyMemberships.memberUserId))
      .where(eq(familyMemberships.ownerUserId, user.id));

    return NextResponse.json({
      inviteUrl: `${req.nextUrl.origin}/family/join/${token}`,
      members,
      slotsUsed: members.length,
      slotsTotal: MAX_FAMILY_MEMBERS,
    });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to load family invite", detail: message }, { status: 500 });
  }
}
