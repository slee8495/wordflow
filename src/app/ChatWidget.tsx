"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { prefetchSpeech, speak } from "@/lib/speak";

const NAME_KEY = "wordflow:name";

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
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [loadingSpeakId, setLoadingSpeakId] = useState<string | null>(null);
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const handledReplyIds = useRef(new Set<string>());
  useEffect(() => {
    if (status !== "ready") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || handledReplyIds.current.has(last.id)) return;
    const text = messageText(last);
    if (!text) return;
    handledReplyIds.current.add(last.id);
    if (autoSpeak) {
      speak(text);
    } else {
      prefetchSpeech(text);
    }
  }, [autoSpeak, status, messages]);

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
    const name = typeof window !== "undefined" ? localStorage.getItem(NAME_KEY) : null;
    sendMessage({ text: name ? `[${name}] ${text}` : text });
  }

  return (
    <>
      {open && (
        <div
          className="fixed bottom-20 right-4 z-20 flex h-[70vh] max-h-[560px] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <span className="text-sm font-semibold">🤖 말씀·교회 Q&A</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAutoSpeak((v) => !v)}
                aria-pressed={autoSpeak}
                aria-label="답변 읽어주기"
                title="답변 읽어주기"
                className={`text-base ${autoSpeak ? "" : "opacity-40"}`}
              >
                {autoSpeak ? "🔊" : "🔇"}
              </button>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-zinc-500">
                &quot;오늘 본문 다시 설명해줘&quot;, &quot;위로가 되는 찬양 추천해줘&quot;, &quot;What does this passage mean?&quot;처럼 물어보세요.
              </p>
            )}
            <div className="flex flex-col gap-3">
              {messages.map((message) => (
                <div key={message.id} className={message.role === "user" ? "text-right" : "text-left"}>
                  <div
                    className={`inline-block max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      message.role === "user"
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    {message.parts.map((part, i) =>
                      part.type === "text" ? <span key={i}>{part.text}</span> : null,
                    )}
                  </div>
                  {message.role === "assistant" && messageText(message) && (
                    <button
                      onClick={async () => {
                        setLoadingSpeakId(message.id);
                        await speak(messageText(message));
                        setLoadingSpeakId((id) => (id === message.id ? null : id));
                      }}
                      disabled={loadingSpeakId === message.id}
                      aria-label="이 답변 읽어주기"
                      title="읽어주기"
                      className="ml-1 align-middle text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-50"
                    >
                      {loadingSpeakId === message.id ? "…" : "🔊"}
                    </button>
                  )}
                </div>
              ))}
              {status === "submitted" && <div className="text-sm text-zinc-400">생각 중…</div>}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim()) return;
              submitText(input);
              setInput("");
            }}
            className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={status !== "ready"}
              placeholder={recording ? "듣고 있어요…" : transcribing ? "변환 중…" : "질문을 입력하세요…"}
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700"
            />
            <button
              type="button"
              onClick={() => (recording ? stopRecording() : startRecording())}
              disabled={status !== "ready" || transcribing}
              aria-pressed={recording}
              aria-label={recording ? "녹음 중지" : "음성으로 질문하기"}
              title={recording ? "녹음 중지" : "음성으로 질문하기"}
              className={`rounded-lg px-3 py-1.5 text-sm disabled:opacity-40 ${
                recording
                  ? "bg-red-600 text-white"
                  : "border border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              }`}
            >
              {recording ? "⏹" : "🎤"}
            </button>
            <button
              type="submit"
              disabled={status !== "ready"}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              전송
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-xl text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Chat"
      >
        {open ? "✕" : "🤖"}
      </button>
    </>
  );
}
