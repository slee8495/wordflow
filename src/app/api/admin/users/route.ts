import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import { AdminOnlyError, requireAdmin } from "@/lib/adminAuth";

export async function GET() {
  try {
    await requireAdmin();

    const rows = await db
      .select({
        userId: users.id,
        email: users.email,
        profileName: profiles.name,
        subscriptionStatus: users.subscriptionStatus,
        currentPeriodEnd: users.currentPeriodEnd,
        compFreeForever: users.compFreeForever,
        compFreeUntil: users.compFreeUntil,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .orderBy(users.email);

    return NextResponse.json({ users: rows });
  } catch (err) {
    if (err instanceof AdminOnlyError) {
      return NextResponse.json({ error: "not_authorized" }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to load users", detail: message }, { status: 500 });
  }
}
