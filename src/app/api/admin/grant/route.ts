import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AdminOnlyError, requireAdmin } from "@/lib/adminAuth";
import { dateStringInTimezone, shiftDateString } from "@/lib/date";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json().catch(() => null);
    const userId = typeof body?.userId === "string" ? body.userId : null;
    const days = typeof body?.days === "number" ? body.days : null;
    if (!userId || !days || days <= 0) {
      return NextResponse.json({ error: "userId and a positive days are required" }, { status: 400 });
    }

    const compFreeUntil = shiftDateString(dateStringInTimezone("UTC"), days);
    await db.update(users).set({ compFreeUntil }).where(eq(users.id, userId));

    return NextResponse.json({ ok: true, compFreeUntil });
  } catch (err) {
    if (err instanceof AdminOnlyError) {
      return NextResponse.json({ error: "not_authorized" }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to grant access", detail: message }, { status: 500 });
  }
}
