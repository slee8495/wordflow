import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { familyMemberships, profiles, referralGrants, users } from "@/db/schema";
import { AdminOnlyError, requireAdmin } from "@/lib/adminAuth";

export async function GET() {
  try {
    await requireAdmin();

    const [rows, allMemberships, allGrants] = await Promise.all([
      db
        .select({
          userId: users.id,
          email: users.email,
          profileName: profiles.name,
          subscriptionStatus: users.subscriptionStatus,
          planType: users.planType,
          currentPeriodEnd: users.currentPeriodEnd,
          compFreeForever: users.compFreeForever,
          compFreeUntil: users.compFreeUntil,
        })
        .from(users)
        .leftJoin(profiles, eq(profiles.userId, users.id))
        .orderBy(users.email),
      db.select({ ownerUserId: familyMemberships.ownerUserId, memberUserId: familyMemberships.memberUserId }).from(familyMemberships),
      db.select({ referrerUserId: referralGrants.referrerUserId, referredUserId: referralGrants.referredUserId }).from(referralGrants),
    ]);

    const emailByUserId = new Map(rows.map((r) => [r.userId, r.email]));

    const memberCountByOwner = new Map<string, number>();
    const ownerByMember = new Map<string, string>();
    for (const m of allMemberships) {
      memberCountByOwner.set(m.ownerUserId, (memberCountByOwner.get(m.ownerUserId) ?? 0) + 1);
      ownerByMember.set(m.memberUserId, m.ownerUserId);
    }

    const referralCountByReferrer = new Map<string, number>();
    const referrerByReferred = new Map<string, string>();
    for (const g of allGrants) {
      referralCountByReferrer.set(g.referrerUserId, (referralCountByReferrer.get(g.referrerUserId) ?? 0) + 1);
      referrerByReferred.set(g.referredUserId, g.referrerUserId);
    }

    const withRelations = rows.map((row) => {
      const ownerUserId = ownerByMember.get(row.userId);
      const referrerUserId = referrerByReferred.get(row.userId);
      return {
        ...row,
        familyRole: memberCountByOwner.has(row.userId) ? ("owner" as const) : ownerUserId ? ("member" as const) : null,
        familyMemberCount: memberCountByOwner.get(row.userId) ?? 0,
        familyOwnerEmail: ownerUserId ? (emailByUserId.get(ownerUserId) ?? ownerUserId) : null,
        referredByEmail: referrerUserId ? (emailByUserId.get(referrerUserId) ?? referrerUserId) : null,
        referralGivenCount: referralCountByReferrer.get(row.userId) ?? 0,
      };
    });

    return NextResponse.json({ users: withRelations });
  } catch (err) {
    if (err instanceof AdminOnlyError) {
      return NextResponse.json({ error: "not_authorized" }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to load users", detail: message }, { status: 500 });
  }
}
