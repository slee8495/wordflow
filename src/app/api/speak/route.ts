import { createHash } from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { gateway, generateSpeech } from "ai";
import { list, put } from "@vercel/blob";
import { SPEECH_MODEL_ID } from "@/lib/ai/model";

export const maxDuration = 60;

const VOICE = "nova";

// Vercel's edge cache (see the Cache-Control below) already serves repeat requests within a
// single deployment, but it resets on every redeploy. Blob storage persists across deployments,
// so a chapter generated once stays instant forever instead of paying the ~4-5s TTS generation
// cost again after the next deploy.
function blobPathFor(text: string) {
  const hash = createHash("sha256").update(`${VOICE}:${text}`).digest("hex");
  return `tts/${VOICE}/${hash}.mp3`;
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

  try {
    const { audio } = await generateSpeech({
      model: gateway.speech(SPEECH_MODEL_ID),
      text,
      voice: VOICE,
      outputFormat: "mp3",
    });

    const buffer = Buffer.from(audio.uint8Array);
    const contentType = audio.mediaType || "audio/mpeg";

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
