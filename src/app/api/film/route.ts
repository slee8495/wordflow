import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { films } from "@/db/schema";
import { authErrorResponse, requireEntitledProfile } from "@/lib/authProfile";

// The narrated film for one curriculum item, if the nightly loop (scripts/film/) has one ready.
// Only a handful exist at any time — the readings just ahead of the operator's progress — so
// `film: null` is the normal answer and the Today tab simply hides the "영상으로 보기" toggle.
export async function GET(req: NextRequest) {
  const itemId = Number(req.nextUrl.searchParams.get("item"));
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "item is required" }, { status: 400 });
  }
  try {
    await requireEntitledProfile();
    const [film] = await db
      .select({
        videoUrl: films.videoUrl,
        posterUrl: films.posterUrl,
        cues: films.cues,
        durationSec: films.durationSec,
        lang: films.lang,
      })
      .from(films)
      .where(and(eq(films.curriculumItemId, itemId), eq(films.status, "ready")))
      .limit(1);
    return NextResponse.json({ film: film?.videoUrl ? film : null });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to load film", detail: message }, { status: 500 });
  }
}
