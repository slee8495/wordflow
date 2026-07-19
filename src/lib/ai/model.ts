// Cheaper model for the lazily-generated daily content (theme/summary/background/message —
// structured writing, doesn't need frontier reasoning).
export const MODEL = "anthropic/claude-haiku-4.5";

// Routed through AI Gateway's speech.() helper, not a plain model id string.
export const SPEECH_MODEL_ID = "openai/tts-1";
