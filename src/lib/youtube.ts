// Auto-matches a worship song to today's theme via YouTube Data API v3 search — no hand-curated
// video list to maintain, at the cost of occasional off-target results.
export type YoutubeResult = { title: string; channelTitle: string; channelId: string; url: string };

async function searchYoutube(
  query: string,
  maxResults: number,
  extraParams: Record<string, string> = {},
): Promise<YoutubeResult[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");

  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: String(maxResults),
    key,
    ...extraParams,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) throw new Error(`YouTube search failed: ${res.status}`);
  const { items } = await res.json();

  return (items ?? []).map(
    (item: { id: { videoId: string }; snippet: { title: string; channelTitle: string; channelId: string } }) => ({
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      channelId: item.snippet.channelId,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }),
  );
}

// Channel subscriber counts, batched into a single API call — used as a dynamic stand-in for "is
// this a real, established worship ministry" instead of a hand-maintained channel-name allowlist,
// which can only ever recognize teams we already knew about the day it was written. A brand-new
// but genuinely popular team clears the bar automatically; a random small upload doesn't.
async function getSubscriberCounts(channelIds: string[]): Promise<Map<string, number>> {
  const key = process.env.YOUTUBE_API_KEY;
  const unique = [...new Set(channelIds)].filter(Boolean);
  if (!key || unique.length === 0) return new Map();

  const params = new URLSearchParams({ part: "statistics", id: unique.join(","), key });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`);
  if (!res.ok) return new Map();
  const { items } = await res.json();

  const counts = new Map<string, number>();
  for (const item of items ?? []) {
    const count = Number(item?.statistics?.subscriberCount ?? 0);
    if (item?.id) counts.set(item.id, count);
  }
  return counts;
}

// Subscriber floor for treating a channel as an established worship ministry rather than an
// unknown/small upload. Tunable — higher trades away more borderline-legitimate hits for fewer
// false positives.
const ESTABLISHED_SUBSCRIBER_THRESHOLD = 50_000;

// The videoCategoryId filter (below) restricts to actual music content, but keyword search can
// still surface clergy talks/liturgy/scripture-reading channels that happen to match on title
// text (reported cases: a Catholic priest's reflection video, and a "daily excerpt" devotional-
// reading channel, both matched a "찬양 {theme}" query despite not being music). Filter those out
// regardless of category as a second layer.
// Deliberately does NOT include "묵상" (meditation) — "묵상찬양" (contemplative worship) is a
// legitimate, common genre label on real worship channels, so that term flagged good results as
// often as bad ones. "발췌문" (devotional excerpt) is unambiguous enough to keep.
const EXCLUDE_TERMS = [
  "신부",
  "강론",
  "미사",
  "성당",
  "수녀",
  "발췌문",
  "큐티",
  "말씀나눔",
  "말씀 나눔",
  "강해",
  "설교",
  "새벽기도",
  "sermon",
  "devotional",
  "bible study",
  "scripture reading",
  "homily",
];

// Positive signal that a result is actually a song, not just uncategorized/mislabeled spoken
// content — used as a fallback when the channel isn't already established by subscriber count.
// Both languages require one of these (or an established channel) rather than blindly falling
// back to the first non-excluded hit: the subscriber-count check above already recognizes big
// artists/channels that don't literally say "worship" in the title (e.g. Keith & Kristyn Getty),
// so requiring a positive signal no longer costs real matches the way it did before that check
// existed — it only used to cut Korean and English differently because Korean channels reliably
// self-label with 워십/찬양/etc. and English channels mostly don't.
const WORSHIP_POSITIVE_TERMS_KO = ["워십", "찬양", "예배", "찬미", "찬송", "worship"];
const WORSHIP_POSITIVE_TERMS_EN = ["worship", "praise"];

function pickWorship(
  results: YoutubeResult[],
  positiveTerms: string[],
  subscriberCounts: Map<string, number>,
  { requirePositiveMatch }: { requirePositiveMatch: boolean },
): YoutubeResult | null {
  const safe = results.filter(
    (r) => !EXCLUDE_TERMS.some((term) => r.title.toLowerCase().includes(term) || r.channelTitle.toLowerCase().includes(term)),
  );
  const established = safe.find((r) => (subscriberCounts.get(r.channelId) ?? 0) >= ESTABLISHED_SUBSCRIBER_THRESHOLD);
  if (established) return established;
  const positiveMatch = safe.find((r) =>
    positiveTerms.some(
      (term) => r.title.toLowerCase().includes(term.toLowerCase()) || r.channelTitle.toLowerCase().includes(term.toLowerCase()),
    ),
  );
  if (positiveMatch) return positiveMatch;
  return requirePositiveMatch ? null : (safe[0] ?? null);
}

// videoDuration: "medium" (4-20 min) excludes YouTube Shorts and the old-style short clips
// that just read a message aloud over a still image. videoCategoryId: "10" restricts results
// to YouTube's Music category, excluding spoken content (sermons, reflections, talks) that a
// plain keyword match can otherwise let through.
export async function searchWorshipSongs(
  themeKo: string,
  themeEn: string,
): Promise<{ ko: YoutubeResult | null; en: YoutubeResult | null }> {
  const [koResults, enResults] = await Promise.all([
    searchYoutube(`찬양 ${themeKo}`, 8, { videoDuration: "medium", videoCategoryId: "10" }),
    searchYoutube(`worship ${themeEn}`, 8, { videoDuration: "medium", videoCategoryId: "10" }),
  ]);

  const subscriberCounts = await getSubscriberCounts([
    ...koResults.map((r) => r.channelId),
    ...enResults.map((r) => r.channelId),
  ]).catch(() => new Map<string, number>());

  return {
    ko: pickWorship(koResults, WORSHIP_POSITIVE_TERMS_KO, subscriberCounts, { requirePositiveMatch: true }),
    en: pickWorship(enResults, WORSHIP_POSITIVE_TERMS_EN, subscriberCounts, { requirePositiveMatch: true }),
  };
}
