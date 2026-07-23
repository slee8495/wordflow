import { NextRequest, NextResponse } from "next/server";
import { chapterCountForBook } from "@/lib/bibleBooks";
import { getOrFetchPassage, logDeepRead } from "@/lib/deepReading";
import { requireProfile } from "@/lib/authProfile";

export const maxDuration = 60;

// Fetches (and caches) one chapter's text for the Reading tab's book/chapter browser. The text
// itself isn't sensitive/personalized (shared cache across every profile — see deepReading.ts),
// so this doesn't require being signed in; it just logs the deep-read event against the caller's
// own linked profile when there is one, instead of trusting a client-supplied name the way this
// used to.
export async function GET(req: NextRequest) {
  const book = req.nextUrl.searchParams.get("book")?.trim();
  const chapterParam = req.nextUrl.searchParams.get("chapter");
  const lang = req.nextUrl.searchParams.get("lang");

  const chapterCount = book ? chapterCountForBook(book) : null;
  const chapter = chapterParam ? Number(chapterParam) : NaN;

  if (!book || chapterCount === null || !Number.isInteger(chapter) || chapter < 1 || chapter > chapterCount) {
    return NextResponse.json({ error: "invalid book/chapter" }, { status: 400 });
  }
  if (lang !== "en" && lang !== "ko") {
    return NextResponse.json({ error: "lang must be 'en' or 'ko'" }, { status: 400 });
  }

  try {
    const content = await getOrFetchPassage(book, chapter, lang);
    const profile = await requireProfile().catch(() => null);
    if (profile) await logDeepRead(profile, book, chapter);
    return NextResponse.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to load passage", detail: message }, { status: 500 });
  }
}
