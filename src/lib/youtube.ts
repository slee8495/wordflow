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

function pickAllowlisted(results: YoutubeResult[], allowlist: string[]): YoutubeResult | null {
  const match = results.find((r) => allowlist.some((name) => r.channelTitle.includes(name)));
  return match ?? results[0] ?? null;
}

// videoDuration: "medium" (4-20 min) excludes YouTube Shorts and the old-style short clips
// that just read a message aloud over a still image.
export async function searchWorshipSongs(
  themeKo: string,
  themeEn: string,
): Promise<{ ko: YoutubeResult | null; en: YoutubeResult | null }> {
  const [koResults, enResults] = await Promise.all([
    searchYoutube(`찬양 ${themeKo}`, 5, { videoDuration: "medium" }),
    searchYoutube(`worship ${themeEn}`, 5, { videoDuration: "medium" }),
  ]);
  return {
    ko: pickAllowlisted(koResults, KOREAN_WORSHIP_CHANNELS),
    en: pickAllowlisted(enResults, ENGLISH_WORSHIP_CHANNELS),
  };
}
