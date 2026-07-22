// Auto-matches a worship song to today's theme via YouTube Data API v3 search — no hand-curated
// video list to maintain, at the cost of occasional off-target results.
export type YoutubeResult = { title: string; channelTitle: string; channelId: string; url: string };

// The YouTube Data API returns title/channelTitle with HTML entities encoded (e.g. an apostrophe
// comes back as "&#39;", "&" as "&amp;") — a quirk of its metadata pipeline, not something any
// param disables. Left undecoded, an apostrophe or "&" in a real title/channel name shows up
// literally as "&#39;"/"&amp;" in the UI instead of being rendered.
const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
};
function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#(\d+)|#x([0-9a-fA-F]+)|([a-zA-Z]+));/g, (match, _whole, dec, hex, named) => {
    if (dec) return String.fromCodePoint(Number(dec));
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    return HTML_ENTITIES[named] ?? match;
  });
}

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
      title: decodeHtmlEntities(item.snippet.title),
      channelTitle: decodeHtmlEntities(item.snippet.channelTitle),
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
// content. Required for EVERY match, regardless of subscriber count — subscriber count used to
// let a result bypass this check entirely ("established" channels were accepted outright), which
// is how a big-but-irrelevant channel (or an established channel whose specific video just isn't
// worship music) could win. Now it's purely a tie-breaker among results that already look like
// worship content.
const WORSHIP_POSITIVE_TERMS_KO = ["워십", "찬양", "예배", "찬미", "찬송", "worship"];
const WORSHIP_POSITIVE_TERMS_EN = ["worship", "praise"];

// Known worship artists/ministries whose branding doesn't always literally say "worship"/"찬양"
// (e.g. Getty Music, Kari Jobe) — counts the same as a literal keyword match so they aren't
// penalized just for not using generic worship vocabulary. Not exhaustive by design (add to it
// as good channels turn up); it's an *additional* positive signal, not the only path to a match —
// a lesser-known but clearly-labeled worship channel still qualifies via the keyword check above.
const KNOWN_WORSHIP_ARTISTS_EN = [
  "hillsong", "elevation worship", "elevation church", "bethel music", "passion", "chris tomlin",
  "kari jobe", "phil wickham", "lauren daigle", "maverick city", "housefires", "vertical worship",
  "cody carnes", "for king & country", "mercyme", "cece winans", "getty", "matt redman",
  "jesus culture", "planetshakers",
];
const KNOWN_WORSHIP_ARTISTS_KO = ["마커스", "위러브", "welove", "예수전도단", "어노인팅", "anointing", "다윗의장막", "제이어스"];

// Structural signal, not a name/channel to memorize: a title that spells out "Chapter N" or "N장"
// reads like a scripture-narration video's auto-generated title ("Ephesians Chapter 2 (God's
// Grace...)", "창세기 27장 (...)"), not a song name. Worship songs may reference a passage (e.g.
// "Psalm 23") but essentially never spell out the word "Chapter"/"장" the way a narration
// channel's title generator does — this generalizes across any channel that titles videos this
// way, instead of needing a new denylist entry every time a new one turns up.
const CITATION_TITLE_PATTERN = /\bchapter\s*\d+\b|\d+\s*장\b/i;

// YouTube's keyword search isn't language-scoped, so a "찬양 {theme}" or "worship {theme}" query
// can surface a result in a completely unrelated language/script (reported: an Arabic prayer
// video matching an English worship search). Requiring the result's own script to match the slot
// it's for is a general check, not a per-language denylist.
const HANGUL_PATTERN = /[가-힣]/;
const OTHER_SCRIPT_PATTERN = /[؀-ۿݐ-ݿ一-鿿぀-ヿЀ-ӿ֐-׿]/;
function matchesLanguage(result: YoutubeResult, lang: "ko" | "en"): boolean {
  const text = `${result.title} ${result.channelTitle}`;
  if (lang === "ko") return HANGUL_PATTERN.test(text);
  return !HANGUL_PATTERN.test(text) && !OTHER_SCRIPT_PATTERN.test(text);
}

// Specific channels/artists that have turned up in past searches but shouldn't be surfaced —
// doctrinally out of step with mainstream Christian worship (reported: a channel with
// Mormon-adjacent content). The structural/language checks above and the positive-match
// requirement below catch most unrelated content on their own; this is defense-in-depth for a
// specific known offender the other checks wouldn't otherwise flag, not the primary mechanism.
const EXCLUDE_CHANNELS = ["kononia", "koinonia watch"];

function pickWorship(
  results: YoutubeResult[],
  lang: "ko" | "en",
  positiveTerms: string[],
  knownArtists: string[],
  subscriberCounts: Map<string, number>,
): YoutubeResult | null {
  const safe = results.filter((r) => {
    const title = r.title.toLowerCase();
    const channel = r.channelTitle.toLowerCase();
    if (EXCLUDE_TERMS.some((term) => title.includes(term) || channel.includes(term))) return false;
    if (EXCLUDE_CHANNELS.some((name) => channel.includes(name))) return false;
    if (CITATION_TITLE_PATTERN.test(r.title)) return false;
    if (!matchesLanguage(r, lang)) return false;
    return true;
  });

  const qualified = safe.filter((r) => {
    const title = r.title.toLowerCase();
    const channel = r.channelTitle.toLowerCase();
    return (
      positiveTerms.some((term) => title.includes(term.toLowerCase()) || channel.includes(term.toLowerCase())) ||
      knownArtists.some((artist) => channel.includes(artist))
    );
  });
  if (qualified.length === 0) return null;

  // Among already-qualified (worship-relevant) results, prefer the more established channel —
  // subscriber count now only affects ordering/production-quality preference, never whether a
  // result is eligible at all.
  qualified.sort((a, b) => (subscriberCounts.get(b.channelId) ?? 0) - (subscriberCounts.get(a.channelId) ?? 0));
  return qualified[0];
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
    ko: pickWorship(koResults, "ko", WORSHIP_POSITIVE_TERMS_KO, KNOWN_WORSHIP_ARTISTS_KO, subscriberCounts),
    en: pickWorship(enResults, "en", WORSHIP_POSITIVE_TERMS_EN, KNOWN_WORSHIP_ARTISTS_EN, subscriberCounts),
  };
}
