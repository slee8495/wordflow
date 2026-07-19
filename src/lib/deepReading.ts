// Backs the Reading tab's book/chapter browser (통독) — independent of the daily curriculum.
// English text comes straight from the NLT API; Korean has no working Bible API (see
// src/lib/bible.ts) so Claude renders it instead, grounded in the NLT text. Both are cached
// permanently in bible_text_cache on first fetch/generation so repeat views by anyone are free
// and the NLT API's daily/monthly quota isn't burned by re-fetching the same chapter.
import { generateText } from "ai";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bibleTextCache, deepReadingLogs, type Profile } from "@/db/schema";
import { fetchNltPassage } from "@/lib/bible";
import { MODEL } from "@/lib/ai/model";
import { profileDateString } from "@/lib/date";

async function readCache(translation: string, book: string, chapter: number): Promise<string | null> {
  const [row] = await db
    .select()
    .from(bibleTextCache)
    .where(
      and(eq(bibleTextCache.translation, translation), eq(bibleTextCache.book, book), eq(bibleTextCache.chapter, chapter)),
    )
    .limit(1);
  return row?.content ?? null;
}

// Verse-numbered only — this is a "read the actual Bible" feature, not the Today tab's
// story-mode devotional paraphrase, so there's no second form to generate/cache per chapter.
async function generateKoreanChapter(book: string, chapter: number, englishText: string): Promise<string> {
  const { text } = await generateText({
    model: MODEL,
    system:
      "당신은 성경 본문을 쉬운 한글로 옮기는 번역가입니다. 원문의 사건과 의미를 정확히 지키되, " +
      "성경을 처음 읽는 사람도 이해할 수 있는 쉬운성경 스타일의 자연스러운 한글로 표현하세요. " +
      "새로운 내용을 지어내지 말고 주어진 영어 본문(NLT)의 내용에 충실하게 옮기세요. " +
      "절 번호를 (1), (2)... 형식으로 붙여 절별로 줄바꿈해 적으세요. 다른 설명 없이 본문만 출력하세요.",
    prompt: `본문: ${book} ${chapter}장\n\n영어 NLT 원문:\n${englishText}`,
  });
  return text.trim();
}

export async function getOrFetchPassage(book: string, chapter: number, lang: "en" | "ko"): Promise<string> {
  const translation = lang === "en" ? "nlt-en" : "claude-ko";
  const cached = await readCache(translation, book, chapter);
  if (cached) return cached;

  const content =
    lang === "en"
      ? await fetchNltPassage(`${book} ${chapter}`)
      : await generateKoreanChapter(book, chapter, await getOrFetchPassage(book, chapter, "en"));

  await db.insert(bibleTextCache).values({ translation, book, chapter, content }).onConflictDoNothing();
  // Concurrent first-fetches could race past the cache-miss check above; re-read so every caller
  // returns the single canonical cached row rather than whichever one insert lost the race.
  return (await readCache(translation, book, chapter)) ?? content;
}

export async function logDeepRead(profile: Profile, book: string, chapter: number): Promise<void> {
  const forDate = profileDateString(profile);
  const [existing] = await db
    .select()
    .from(deepReadingLogs)
    .where(
      and(
        eq(deepReadingLogs.profileId, profile.id),
        eq(deepReadingLogs.book, book),
        eq(deepReadingLogs.chapter, chapter),
        eq(deepReadingLogs.forDate, forDate),
      ),
    )
    .limit(1);
  if (existing) return;

  await db.insert(deepReadingLogs).values({ profileId: profile.id, book, chapter, forDate });
}
