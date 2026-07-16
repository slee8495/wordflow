// Fetches the day's passage text in both translations so it can be fed to Claude as source
// material for the story/context/message write-up, and shown/read aloud to the user directly.
//
// NOTE: fetchNltPassage is verified working against a live key. fetchKoreanPassage's request
// shape is still unverified — API.Bible's key rejected requests with "Invalid API key" during
// setup (see README "API 키 체크리스트"); re-test once that's sorted out.

const NLT_API_BASE = "https://api.nlt.to/api/passages";
// American Bible Society's API.Bible — used for the Korean 새번역 (RNKSV) passage text.
// Set BIBLE_API_KO_BIBLE_ID once you've confirmed 새번역's bible ID from the /bibles endpoint
// (falls back to 개역개정 if 새번역 isn't in the Starter plan's catalog).
const API_BIBLE_BASE = "https://api.scripture.api.bible/v1";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchNltPassage(reference: string): Promise<string> {
  const key = process.env.NLT_API_KEY;
  if (!key) throw new Error("NLT_API_KEY is not set");

  // Confirmed against a live key: this always returns HTML regardless of a `json` param, so
  // stripHtml() below is load-bearing, not just a safety net.
  const url = `${NLT_API_BASE}?ref=${encodeURIComponent(reference)}&key=${key}&version=NLT`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NLT API request failed: ${res.status}`);
  const body = await res.text();
  return stripHtml(body);
}

export async function fetchKoreanPassage(reference: string): Promise<string> {
  const key = process.env.BIBLE_API_KEY;
  const bibleId = process.env.BIBLE_API_KO_BIBLE_ID;
  if (!key || !bibleId) throw new Error("BIBLE_API_KEY / BIBLE_API_KO_BIBLE_ID is not set");

  // TODO: API.Bible's /passages endpoint takes its own dot-notation passage ID (e.g.
  // "GEN.1.1-GEN.2.3"), not a human-readable reference — add a reference-to-passageId mapper
  // once a real bibleId/key exists and the catalog's ID format for this Bible is confirmed.
  const url = `${API_BIBLE_BASE}/bibles/${bibleId}/passages/${encodeURIComponent(reference)}?content-type=text`;
  const res = await fetch(url, { headers: { "api-key": key } });
  if (!res.ok) throw new Error(`API.Bible request failed: ${res.status}`);
  const { data } = await res.json();
  return stripHtml(data?.content ?? "");
}
