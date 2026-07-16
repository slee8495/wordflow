// Auto-matches worship songs / sermons to today's theme via YouTube Data API v3 search —
// no hand-curated list to maintain, at the cost of occasional off-target results.
export type YoutubeResult = { title: string; channelTitle: string; url: string };

async function searchYoutube(query: string, maxResults: number): Promise<YoutubeResult[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");

  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: String(maxResults),
    key,
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

export function searchWorshipSongs(theme: string, maxResults = 3): Promise<YoutubeResult[]> {
  return searchYoutube(`찬양 ${theme}`, maxResults);
}

export function searchSermons(theme: string, passageRef: string, maxResults = 2): Promise<YoutubeResult[]> {
  return searchYoutube(`설교 ${passageRef} ${theme}`, maxResults);
}
