// Fetches the day's passage text so it can be fed to Claude as source material for the
// story/context/message write-up, and shown/read aloud to the user directly.
//
// NOTE: Korean text isn't fetched from an external Bible API — API.Bible's key kept rejecting
// requests with "Invalid API key" even after signup, so instead Claude renders the Korean
// passage itself (see generateKoreanPassage in generateReading.ts), grounded in this NLT text.

const NLT_API_BASE = "https://api.nlt.to/api/passages";

// Strips a <span class="tn">...</span> translator-footnote block, correctly handling the
// <span class="tn-ref"> it always nests one level inside — a plain non-greedy regex would stop
// at that inner span's closing tag and leave the footnote's actual text behind mid-sentence.
function stripFootnoteSpans(html: string): string {
  const openTag = '<span class="tn">';
  let result = "";
  let i = 0;
  for (;;) {
    const start = html.indexOf(openTag, i);
    if (start === -1) {
      result += html.slice(i);
      return result;
    }
    result += html.slice(i, start);

    let depth = 1;
    let pos = start + openTag.length;
    while (depth > 0 && pos < html.length) {
      const nextOpen = html.indexOf("<span", pos);
      const nextClose = html.indexOf("</span>", pos);
      if (nextClose === -1) {
        pos = html.length;
        break;
      }
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + "<span".length;
      } else {
        depth--;
        pos = nextClose + "</span>".length;
      }
    }
    i = pos;
  }
}

// The NLT API always returns a full HTML page (title/stylesheet in <head>, passage in
// <div id="bibletext">) regardless of a `json` param, with citation headers, per-chapter
// headers, and translator footnotes all interleaved *inside* the verse text — a plain tag-strip
// left literal junk like "NLT API Genesis 1:1-2:3, NLT ... 1:1 Or In the beginning when God
// created ..." mixed into the passage. This extracts just the verse text, drops that metadata,
// and puts each verse on its own "(N) " line to match the Korean by-verse format.
function extractPassageText(html: string): string {
  const bodyMatch = html.match(/<div id="bibletext"[^>]*>([\s\S]*?)<\/div>\s*<\/body>/);
  let content = bodyMatch ? bodyMatch[1] : html;

  content = content
    .replace(/<h2 class="bk_ch_vs_header">[\s\S]*?<\/h2>/g, "")
    .replace(/<h2 class="chapter-number">[\s\S]*?<\/h2>/g, "")
    .replace(/<h3 class="subhead">[\s\S]*?<\/h3>/g, "")
    .replace(/<a class="a-tn">[\s\S]*?<\/a>/g, "");
  content = stripFootnoteSpans(content);
  content = content.replace(/<span class="vn">(\d+)<\/span>/g, "\n($1) ");

  return content
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export async function fetchNltPassage(reference: string): Promise<string> {
  const key = process.env.NLT_API_KEY;
  if (!key) throw new Error("NLT_API_KEY is not set");

  // Confirmed against a live key: this always returns HTML regardless of a `json` param, so
  // extractPassageText() below is load-bearing, not just a safety net.
  const url = `${NLT_API_BASE}?ref=${encodeURIComponent(reference)}&key=${key}&version=NLT`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NLT API request failed: ${res.status}`);
  const body = await res.text();
  return extractPassageText(body);
}
