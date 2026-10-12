import { createHash } from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { gateway, generateSpeech } from "ai";
import { list, put } from "@vercel/blob";
import { SPEECH_MODEL_ID } from "@/lib/ai/model";
import { wavToMp3 } from "@/lib/ai/wavToMp3";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const maxDuration = 60;

const VOICE = "Aoede";

// Without this, quoted dialogue came out in the same flat cadence as narration. Each request is
// one ~200-character chunk, so the prompt has to work without seeing the rest of the passage.
const SPEECH_INSTRUCTIONS =
  "Narrate this like a skilled audiobook narrator. Narration: calm, warm storyteller voice. " +
  "Dialogue inside quotation marks: perform it with the emotion the context implies (sarcasm, fear, " +
  "tenderness, desperation), shifting tone and pace slightly between speakers so lines sound spoken, " +
  "not read. Natural, not theatrical. Never pronounce the quotation marks.";

// Vercel's edge cache (see the Cache-Control below) already serves repeat requests within a
// single deployment, but it resets on every redeploy. Blob storage persists across deployments,
// so a chapter generated once stays instant forever instead of paying the ~4-5s TTS generation
// cost again after the next deploy.
function blobPathFor(text: string) {
  // The old voice's files (tts/nova/…) stay in Blob storage, they're just never looked up again.
  const hash = createHash("sha256").update(`${SPEECH_MODEL_ID}:${VOICE}:${text}`).digest("hex");
  return `tts/gemini-${VOICE.toLowerCase()}/${hash}.mp3`;
}

// Neural TTS for reading passages/chat replies aloud, routed through AI Gateway. The client
// falls back to the browser's Web Speech API if this request fails.
export async function GET(req: NextRequest) {
  const text = (req.nextUrl.searchParams.get("text") ?? "").trim().slice(0, 2000);
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const pathname = blobPathFor(text);

  try {
    const { blobs } = await list({ prefix: pathname, limit: 1 });
    const cached = blobs.find((b) => b.pathname === pathname);
    if (cached) {
      return NextResponse.redirect(cached.url, { status: 302 });
    }
  } catch {
    // Blob lookup failing shouldn't block playback — fall through to a fresh TTS generation.
  }

  // Only the generation path costs real money — a cache hit above already returned. Allows a
  // generous burst (a long chapter can fire 20-30 chunk requests in parallel on first listen)
  // while still capping a scripted flood of arbitrary text through this unauthenticated endpoint.
  const allowed = await checkRateLimit(`speak:${clientIp(req)}`, 40, 60);
  if (!allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  try {
    const { audio } = await generateSpeech({
      model: gateway.speech(SPEECH_MODEL_ID),
      text,
      voice: VOICE,
      instructions: SPEECH_INSTRUCTIONS,
    });

    const buffer = Buffer.from(wavToMp3(audio.uint8Array));
    const contentType = "audio/mpeg";

    // Runs after the response is sent, but Next.js keeps the function alive until it settles —
    // unlike a bare unawaited promise, which risks being killed the moment the response flushes.
    after(() =>
      put(pathname, buffer, {
        access: "public",
        contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 31536000,
      }).catch(() => {
        // Best-effort: a failed cache write still lets this response play normally.
      }),
    );

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "tts failed", detail: message }, { status: 500 });
  }
}
