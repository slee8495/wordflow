import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";

// Best-effort "resume where you left off" persistence — the client's saveBookmark() (src/lib/
// bookmark.ts) is fire-and-forget, so this only ever needs to report success/failure for
// debugging, never anything a page acts on.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (body?.kind !== "reading" && body?.kind !== "today") {
    return NextResponse.json({ error: "kind must be 'reading' or 'today'" }, { status: 400 });
  }
  if (!body.bookmark || typeof body.bookmark !== "object") {
    return NextResponse.json({ error: "bookmark is required" }, { status: 400 });
  }

  try {
    const profile = await requireProfile();
    await db
      .update(profiles)
      .set(body.kind === "reading" ? { readingBookmark: body.bookmark } : { todayBookmark: body.bookmark })
      .where(eq(profiles.id, profile.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to save bookmark", detail: message }, { status: 500 });
  }
}
