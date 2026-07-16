import { NextRequest, NextResponse } from "next/server";
import { gateway, transcribe } from "ai";
import { TRANSCRIPTION_MODEL_ID } from "@/lib/ai/model";
import { isAuthorizedRequest } from "@/lib/apiAuth";

export const maxDuration = 60;

// Speech-to-text for the chat assistant's mic input (한국어/English), routed through AI Gateway.
// Takes the recorded clip as multipart form data (browser MediaRecorder output).
export async function POST(req: NextRequest) {
  if (!isAuthorizedRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "audio file is required" }, { status: 400 });
  }

  try {
    const audio = new Uint8Array(await file.arrayBuffer());
    const { text, language } = await transcribe({
      model: gateway.transcription(TRANSCRIPTION_MODEL_ID),
      audio,
    });
    return NextResponse.json({ text, language });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "transcription failed", detail: message }, { status: 500 });
  }
}
