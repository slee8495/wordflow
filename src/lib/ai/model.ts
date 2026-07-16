import { anthropic } from "@ai-sdk/anthropic";

// Cheaper model for the nightly cron-driven daily content generation (theme/summary/background/
// message — structured writing, doesn't need frontier reasoning). The interactive chat assistant
// uses CHAT_MODEL instead, since that's on-demand/low-volume and benefits more from a stronger model.
export const MODEL = "anthropic/claude-haiku-4.5";
export const CHAT_MODEL = "anthropic/claude-sonnet-5";

// Routed through AI Gateway's speech.() / transcription.() helpers, not plain model id strings.
export const SPEECH_MODEL_ID = "openai/tts-1";
// whisper-1, not gpt-4o-mini-transcribe: the gpt-4o-transcribe family has unreliable language
// auto-detection on short clips, which matters here since voice input is bilingual (한국어/English).
export const TRANSCRIPTION_MODEL_ID = "openai/whisper-1";

export function webSearchTool(maxUses = 4) {
  return anthropic.tools.webSearch_20250305({ maxUses });
}
