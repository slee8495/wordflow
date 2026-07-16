"use client";

import { useEffect, useState } from "react";
import { speak } from "@/lib/speak";

const NAME_KEY = "wordflow:name";

type WorshipLink = { title: string; url: string };
type SermonLink = { title: string; channel: string; url: string };
type Reading = {
  theme: string;
  storySummary: string;
  historicalContext: string;
  personalMessage: string;
  passageTextKo: string | null;
  passageTextEn: string | null;
  worshipLinks: WorshipLink[];
  sermonLinks: SermonLink[];
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">{title}</h2>
      {children}
    </section>
  );
}

export default function Home() {
  const [name, setName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [reading, setReading] = useState<Reading | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    // localStorage only exists client-side, so this can't be a lazy useState initializer
    // without risking a hydration mismatch against the server-rendered name gate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(localStorage.getItem(NAME_KEY));
  }, []);

  useEffect(() => {
    if (!name) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch(`/api/today?name=${encodeURIComponent(name)}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed to load today's reading");
        return res.json();
      })
      .then(({ reading }) => setReading(reading))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [name]);

  if (name === null) {
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nameInput.trim()) return;
          localStorage.setItem(NAME_KEY, nameInput.trim());
          setName(nameInput.trim());
        }}
      >
        <p className="text-sm text-zinc-500">이름을 입력하면 나만의 통독 진도가 저장돼요.</p>
        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="이름"
          className="rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          시작하기
        </button>
      </form>
    );
  }

  const fullText = reading
    ? [reading.storySummary, reading.historicalContext, reading.personalMessage].join(" ")
    : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">{name}님, 오늘의 말씀</span>
        <button
          onClick={() => {
            localStorage.removeItem(NAME_KEY);
            setName(null);
            setReading(null);
          }}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          이름 바꾸기
        </button>
      </div>

      {loading && <p className="text-sm text-zinc-400">오늘의 말씀을 준비하고 있어요…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {reading && (
        <>
          <div className="flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <h1 className="text-lg font-semibold">{reading.theme}</h1>
            <button
              onClick={async () => {
                setSpeaking(true);
                await speak(fullText);
                setSpeaking(false);
              }}
              disabled={speaking}
              className="text-xl disabled:opacity-50"
              aria-label="오늘의 말씀 듣기"
            >
              {speaking ? "…" : "🔊"}
            </button>
          </div>

          <Section title="오늘의 이야기">
            <p className="text-sm leading-relaxed whitespace-pre-line">{reading.storySummary}</p>
          </Section>

          <Section title="앞뒤 흐름 · 역사적 배경">
            <p className="text-sm leading-relaxed whitespace-pre-line">{reading.historicalContext}</p>
          </Section>

          <Section title="오늘 하나님이 주시는 메시지">
            <p className="text-sm leading-relaxed whitespace-pre-line">{reading.personalMessage}</p>
          </Section>

          {reading.worshipLinks.length > 0 && (
            <Section title="관련 찬양">
              <ul className="flex flex-col gap-1.5">
                {reading.worshipLinks.map((link) => (
                  <li key={link.url}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                      🎵 {link.title}
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {reading.sermonLinks.length > 0 && (
            <Section title="관련 설교">
              <ul className="flex flex-col gap-1.5">
                {reading.sermonLinks.map((link) => (
                  <li key={link.url}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                      🎤 {link.title} <span className="text-zinc-400">· {link.channel}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
