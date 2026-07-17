// Auto-matches a worship song to today's theme via YouTube Data API v3 search — no hand-curated
// video list to maintain, at the cost of occasional off-target results.
export type YoutubeResult = { title: string; channelTitle: string; url: string };

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

  return (items ?? []).map((item: { id: { videoId: string }; snippet: { title: string; channelTitle: string } }) => ({
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));
}

// Best-effort substring match on channelTitle — no verified channel IDs on hand, so this is
// a name allowlist rather than an exact channelId filter. Extend as specific channels prove
// reliable; a hardcoded channelId filter would be more precise once we have real IDs.
const KOREAN_WORSHIP_CHANNELS = ["예수전도단", "YWAM Worship Korea"];
const ENGLISH_WORSHIP_CHANNELS = [
  "Bethel Music",
  "Elevation Worship",
  "Hillsong Worship",
  "Housefires",
  "Maverick City Music",
];

// The videoCategoryId filter (below) restricts to actual music content, but keyword search can
// still surface clergy talks/liturgy that happen to match on title text (reported case: a
// Catholic priest's reflection video matched a "찬양 {theme}" query). Filter those out
// regardless of category as a second layer.
const EXCLUDE_TERMS = ["신부", "강론", "미사", "성당", "수녀"];

function pickWorship(results: YoutubeResult[], allowlist: string[]): YoutubeResult | null {
  const safe = results.filter(
    (r) => !EXCLUDE_TERMS.some((term) => r.title.includes(term) || r.channelTitle.includes(term)),
  );
  const match = safe.find((r) => allowlist.some((name) => r.channelTitle.includes(name)));
  return match ?? safe[0] ?? null;
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
  return {
    ko: pickWorship(koResults, KOREAN_WORSHIP_CHANNELS),
    en: pickWorship(enResults, ENGLISH_WORSHIP_CHANNELS),
  };
}
