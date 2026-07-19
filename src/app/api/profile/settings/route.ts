import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";

// Best-effort sync of the client's UI-language setting onto the profile row, so server-side code
// with no request/session context (the morning-reminder cron) can still compose text in the
// right language. Fire-and-forget from the client — never blocks or surfaces errors to the user.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = body?.name?.trim();
  const uiLang = body?.uiLang === "ko" ? "ko" : body?.uiLang === "en" ? "en" : null;
  if (!name || !uiLang) return NextResponse.json({ error: "name and a valid uiLang are required" }, { status: 400 });

  await db.update(profiles).set({ uiLang }).where(eq(profiles.name, name));
  return NextResponse.json({ status: "ok" });
}
