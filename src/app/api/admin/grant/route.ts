import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AdminOnlyError, requireAdmin } from "@/lib/adminAuth";
import { dateStringInTimezone, shiftDateString } from "@/lib/date";

// action: "grantDays" (custom time-limited comp, via compFreeUntil), "grantForever" (permanent
// comp, via compFreeForever), or "revoke" (clears both — does not touch a real Stripe
// subscription, only comp access layered on top of it).
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json().catch(() => null);
    const userId = typeof body?.userId === "string" ? body.userId : null;
    const action = body?.action;
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (action === "grantDays") {
      const days = typeof body?.days === "number" ? body.days : null;
      if (!days || days <= 0) {
        return NextResponse.json({ error: "a positive days is required" }, { status: 400 });
      }
      const compFreeUntil = shiftDateString(dateStringInTimezone("UTC"), days);
      await db.update(users).set({ compFreeUntil }).where(eq(users.id, userId));
      return NextResponse.json({ ok: true, compFreeUntil });
    }

    if (action === "grantForever") {
      await db.update(users).set({ compFreeForever: true }).where(eq(users.id, userId));
      return NextResponse.json({ ok: true });
    }

    if (action === "revoke") {
      await db.update(users).set({ compFreeForever: false, compFreeUntil: null }).where(eq(users.id, userId));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof AdminOnlyError) {
      return NextResponse.json({ error: "not_authorized" }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to update comp access", detail: message }, { status: 500 });
  }
}
