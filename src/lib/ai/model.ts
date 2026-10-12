// Cheaper model for the lazily-generated daily content (theme/summary/background/message —
// structured writing, doesn't need frontier reasoning).
export const MODEL = "anthropic/claude-haiku-4.5";

// Routed through AI Gateway's speech.() helper, not a plain model id string. Gemini TTS over
// openai/tts-1 because it takes a performance prompt (SPEECH_INSTRUCTIONS in /api/speak) — tts-1
// read quoted dialogue in the same flat cadence as narration. Similar cost (~$0.8 per narrated
// hour), but slower to generate (~5-10s per chunk vs 2-4s), and it only returns WAV.
export const SPEECH_MODEL_ID = "google/gemini-3.8-flash-tts";
