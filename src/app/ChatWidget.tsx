"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { prefetchSpeech } from "@/lib/speak";
import { usePlayback } from "./PlaybackProvider";
import { useUiLanguage } from "./UiLanguageProvider";
import { useUser } from "./UserProvider";

function chatSourceId(messageId: string) {
  return `chat-${messageId}`;
}

function messageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();
}

const RECORDING_MIME_TYPES = ["audio/webm", "audio/mp4", "audio/ogg"];

function pickRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return RECORDING_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function ChatWidget() {
  const { name } = useUser();
  const { t } = useUiLanguage();
  const { sourceId, label, speakState, playText, pause, resume, stop } = usePlayback();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const speakMessage = useCallback(
    (id: string, text: string) => {
      if (!text.trim()) return;
      playText(chatSourceId(id), text.slice(0, 60), text);
    },
    [playText],
  );

  const handledReplyIds = useRef(new Set<string>());
  useEffect(() => {
    if (status !== "ready") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || handledReplyIds.current.has(last.id)) return;
    const text = messageText(last);
    if (!text) return;
    handledReplyIds.current.add(last.id);
    if (autoSpeak) {
      speakMessage(last.id, text);
    } else {
      prefetchSpeech(text);
    }
  }, [autoSpeak, status, messages, speakMessage]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("audio", blob, "voice-input.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          if (!res.ok) throw new Error("transcription failed");
          const { text } = await res.json();
          if (text?.trim()) sendMessage({ text: text.trim() });
        } catch {
          // best-effort — silently drop, user can just type instead
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      // mic permission denied or unsupported — no-op, user can still type
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  function submitText(text: string) {
    sendMessage({ text: name ? `[${name}] ${text}` : text });
  }

  return (
    <>
      {open && (
        <div
          className={`fixed right-4 z-20 flex h-[70vh] max-h-[560px] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] shadow-xl ${
            label ? "bottom-36" : "bottom-20"
          }`}
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
            <span className="text-sm font-semibold">{t("chat.title")}</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAutoSpeak((v) => !v)}
                aria-pressed={autoSpeak}
                aria-label={t("chat.readAloudToggle")}
                title={t("chat.readAloudToggle")}
                className={`text-base ${autoSpeak ? "" : "opacity-40"}`}
              >
                {autoSpeak ? "🔊" : "🔇"}
              </button>
              <button onClick={() => setOpen(false)} className="text-[var(--ink-soft)] hover:text-[var(--ink)]">
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && <p className="text-sm text-[var(--ink-soft)]">{t("chat.emptyHint")}</p>}
            <div className="flex flex-col gap-3">
              {messages.map((message) => (
                <div key={message.id} className={message.role === "user" ? "text-right" : "text-left"}>
                  <div
                    className={`inline-block max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      message.role === "user"
                        ? "bg-[var(--clay-deep)] text-[var(--paper-raised)]"
                        : "bg-[var(--clay-tint)] text-[var(--ink)]"
                    }`}
                  >
                    {message.parts.map((part, i) =>
                      part.type === "text" ? <span key={i}>{part.text}</span> : null,
                    )}
                  </div>
                  {message.role === "assistant" &&
                    messageText(message) &&
                    (sourceId !== chatSourceId(message.id) ? (
                      <button
                        onClick={() => speakMessage(message.id, messageText(message))}
                        aria-label={t("chat.readThisReply")}
                        title={t("chat.listen")}
                        className="ml-1 align-middle text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"
                      >
                        🔊
                      </button>
                    ) : (
                      <span className="ml-1 inline-flex items-center gap-2 align-middle">
                        <button
                          onClick={() => (speakState === "paused" ? resume() : pause())}
                          disabled={speakState === "loading"}
                          aria-label={speakState === "paused" ? t("chat.resume") : t("chat.pause")}
                          title={speakState === "paused" ? t("chat.resume") : t("chat.pause")}
                          className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-50"
                        >
                          {speakState === "loading" ? "…" : speakState === "paused" ? "▶️" : "⏸️"}
                        </button>
                        <button
                          onClick={stop}
                          aria-label={t("chat.stopListening")}
                          title={t("chat.stopListening")}
                          className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"
                        >
                          ⏹️
                        </button>
                      </span>
                    ))}
                </div>
              ))}
              {status === "submitted" && <div className="text-sm text-[var(--ink-soft)]">{t("chat.thinking")}</div>}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim()) return;
              submitText(input);
              setInput("");
            }}
            className="flex gap-2 border-t border-[var(--line)] p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={status !== "ready"}
              placeholder={
                recording ? t("chat.inputListening") : transcribing ? t("chat.inputTranscribing") : t("chat.inputPlaceholder")
              }
              className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--clay)]"
            />
            <button
              type="button"
              onClick={() => (recording ? stopRecording() : startRecording())}
              disabled={status !== "ready" || transcribing}
              aria-pressed={recording}
              aria-label={recording ? t("chat.stopRecording") : t("chat.askByVoice")}
              title={recording ? t("chat.stopRecording") : t("chat.askByVoice")}
              className={`rounded-lg px-3 py-1.5 text-sm disabled:opacity-40 ${
                recording
                  ? "bg-red-600 text-white"
                  : "border border-[var(--line)] text-[var(--ink-soft)]"
              }`}
            >
              {recording ? "⏹" : "🎤"}
            </button>
            <button
              type="submit"
              disabled={status !== "ready"}
              className="rounded-lg bg-[var(--clay-deep)] px-3 py-1.5 text-sm font-medium text-[var(--paper-raised)] disabled:opacity-40"
            >
              {t("chat.send")}
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className={`fixed right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--clay-deep)] text-xl text-[var(--paper-raised)] shadow-lg ${
          label ? "bottom-20" : "bottom-4"
        }`}
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        aria-label={t("chat.toggle")}
      >
        {open ? "✕" : "🤖"}
      </button>
    </>
  );
}
