import { NextRequest, NextResponse } from "next/server";
import { chapterCountForBook } from "@/lib/bibleBooks";
import { getOrFetchPassage, logDeepRead } from "@/lib/deepReading";
import { findOrCreateProfile } from "@/lib/generateReading";

export const maxDuration = 60;

// Fetches (and caches) one chapter's text for the Reading tab's book/chapter browser, and logs
// it as a deep-reading event for the given profile if `name` is provided.
export async function GET(req: NextRequest) {
  const book = req.nextUrl.searchParams.get("book")?.trim();
  const chapterParam = req.nextUrl.searchParams.get("chapter");
  const lang = req.nextUrl.searchParams.get("lang");
  const name = req.nextUrl.searchParams.get("name")?.trim();

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
    if (name) {
      const profile = await findOrCreateProfile(name);
      await logDeepRead(profile, book, chapter);
    }
    return NextResponse.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to load passage", detail: message }, { status: 500 });
  }
}
