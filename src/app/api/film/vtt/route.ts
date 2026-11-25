import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { films } from "@/db/schema";
import { authErrorResponse, requireEntitledProfile } from "@/lib/authProfile";
import { cuesToVtt } from "@/lib/filmVtt";

// Subtitle track for the film player's <track> — served from the app's own origin (a <track> from
// another origin needs CORS on the video too) so the phone's full-screen player can show it.
export async function GET(req: NextRequest) {
  const itemId = Number(req.nextUrl.searchParams.get("item"));
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "item is required" }, { status: 400 });
  }
  try {
    await requireEntitledProfile();
    const [film] = await db
      .select({ cues: films.cues })
      .from(films)
      .where(and(eq(films.curriculumItemId, itemId), eq(films.status, "ready")))
      .limit(1);
    return new NextResponse(cuesToVtt(film?.cues), {
      headers: { "Content-Type": "text/vtt; charset=utf-8", "Cache-Control": "private, max-age=3600" },
    });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    return NextResponse.json({ error: "failed to load subtitles" }, { status: 500 });
  }
}
