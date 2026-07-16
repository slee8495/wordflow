// Fetches the day's passage text so it can be fed to Claude as source material for the
// story/context/message write-up, and shown/read aloud to the user directly.
//
// NOTE: Korean text isn't fetched from an external Bible API — API.Bible's key kept rejecting
// requests with "Invalid API key" even after signup, so instead Claude renders the Korean
// passage itself (see generateKoreanPassage in generateReading.ts), grounded in this NLT text.

const NLT_API_BASE = "https://api.nlt.to/api/passages";

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
