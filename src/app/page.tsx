"use client";

import { useEffect, useState } from "react";
import { speak } from "@/lib/speak";
import { formatPassageRefEnglish, formatPassageRefKorean } from "@/lib/passageRef";

const NAME_KEY = "wordflow:name";
const LANG_KEY = "wordflow:lang";

type WorshipLink = { title: string; url: string };
type SermonLink = { title: string; channel: string; url: string };
type Reading = {
  theme: string;
  themeEn: string | null;
  storySummary: string;
  storySummaryEn: string | null;
  historicalContext: string;
  historicalContextEn: string | null;
  personalMessage: string;
  personalMessageEn: string | null;
  passageTextKoVerses: string | null;
  passageTextKoStory: string | null;
  passageTextEn: string | null;
  passageRef: string | null;
  worshipLinks: WorshipLink[];
  sermonLinks: SermonLink[];
};

function Section({
  title,
  subtitle,
  children,
  onSpeak,
  speaking,
}: {
  title: string;
  subtitle?: string | null;
  children: React.ReactNode;
  onSpeak?: () => void;
  speaking?: boolean;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          {title}
          {subtitle && <span className="ml-2 font-normal text-zinc-400 dark:text-zinc-500">{subtitle}</span>}
        </h2>
        {onSpeak && (
          <button
            onClick={onSpeak}
            disabled={speaking}
            className="text-base disabled:opacity-50"
            aria-label={`Listen to ${title}`}
          >
            {speaking ? "…" : "🔊"}
          </button>
        )}
      </div>
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
  const [passageView, setPassageView] = useState<"verses" | "story">("verses");
  const [contentLanguage, setContentLanguage] = useState<"ko" | "en">("ko");
  const [speakingSection, setSpeakingSection] = useState<string | null>(null);
  const [generatingNext, setGeneratingNext] = useState(false);

  useEffect(() => {
    // localStorage only exists client-side, so this can't be a lazy useState initializer
    // without risking a hydration mismatch against the server-rendered name gate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(localStorage.getItem(NAME_KEY));
    const storedLang = localStorage.getItem(LANG_KEY);
    if (storedLang === "en" || storedLang === "ko") {
      setContentLanguage(storedLang);
    }
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

  function setLanguage(lang: "ko" | "en") {
    setContentLanguage(lang);
    localStorage.setItem(LANG_KEY, lang);
  }

  async function speakSection(id: string, text: string | null) {
    if (!text?.trim()) return;
    setSpeakingSection(id);
    await speak(text);
    setSpeakingSection((current) => (current === id ? null : current));
  }

  async function readNext() {
    if (!name || generatingNext) return;
    setGeneratingNext(true);
    setError(null);
    try {
      const res = await fetch("/api/today/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("failed to generate the next reading");
      const { reading } = await res.json();
      setReading(reading);
      setPassageView("verses");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingNext(false);
    }
  }

  const todayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

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
        <p className="text-sm text-zinc-500">Enter your name to save your reading progress.</p>
        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Name"
          className="rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Start
        </button>
      </form>
    );
  }

  const pick = (en: string | null | undefined, ko: string) => (contentLanguage === "en" ? (en ?? ko) : ko);

  const passageText =
    contentLanguage === "en"
      ? reading?.passageTextEn
      : ((passageView === "story" ? reading?.passageTextKoStory : reading?.passageTextKoVerses) ??
        reading?.passageTextKoStory ??
        reading?.passageTextKoVerses);

  const rangeLabel = reading?.passageRef
    ? contentLanguage === "en"
      ? formatPassageRefEnglish(reading.passageRef)
      : formatPassageRefKorean(reading.passageRef)
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">{todayLabel}</span>
        <div className="flex gap-1 rounded-full bg-zinc-100 p-0.5 text-xs dark:bg-zinc-800">
          <button
            onClick={() => setLanguage("ko")}
            className={`rounded-full px-2 py-1 ${
              contentLanguage === "ko"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"
                : "text-zinc-500"
            }`}
          >
            한글
          </button>
          <button
            onClick={() => setLanguage("en")}
            className={`rounded-full px-2 py-1 ${
              contentLanguage === "en"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"
                : "text-zinc-500"
            }`}
          >
            English
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">Hi {name} — today&apos;s reading</span>
        <button
          onClick={() => {
            localStorage.removeItem(NAME_KEY);
            setName(null);
            setReading(null);
          }}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Change name
        </button>
      </div>

      {loading && <p className="text-sm text-zinc-400">Preparing today&apos;s reading…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {reading && (
        <>
          <div className="rounded-xl bg-zinc-900 px-4 py-3 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <h1 className="text-lg font-semibold">{pick(reading.themeEn, reading.theme)}</h1>
          </div>

          {(reading.passageTextKoVerses || reading.passageTextKoStory || reading.passageTextEn) && (
            <Section
              title="Today's Passage"
              subtitle={rangeLabel}
              onSpeak={() => speakSection("passage", passageText ?? null)}
              speaking={speakingSection === "passage"}
            >
              {contentLanguage === "ko" && (
                <div className="mb-2 flex gap-1.5">
                  <button
                    onClick={() => setPassageView("verses")}
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      passageView === "verses"
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                    }`}
                  >
                    By Verse
                  </button>
                  <button
                    onClick={() => setPassageView("story")}
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      passageView === "story"
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                    }`}
                  >
                    As a Story
                  </button>
                </div>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-line">{passageText}</p>
            </Section>
          )}

          <Section
            title="Today's Story"
            onSpeak={() => speakSection("story", pick(reading.storySummaryEn, reading.storySummary))}
            speaking={speakingSection === "story"}
          >
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {pick(reading.storySummaryEn, reading.storySummary)}
            </p>
          </Section>

          <Section
            title="Context & Background"
            onSpeak={() => speakSection("context", pick(reading.historicalContextEn, reading.historicalContext))}
            speaking={speakingSection === "context"}
          >
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {pick(reading.historicalContextEn, reading.historicalContext)}
            </p>
          </Section>

          <Section
            title="Today's Message"
            onSpeak={() => speakSection("message", pick(reading.personalMessageEn, reading.personalMessage))}
            speaking={speakingSection === "message"}
          >
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {pick(reading.personalMessageEn, reading.personalMessage)}
            </p>
          </Section>

          {reading.worshipLinks.length > 0 && (
            <Section title="Worship">
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
            <Section title="Sermon">
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

          <button
            onClick={readNext}
            disabled={generatingNext}
            className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
          >
            {generatingNext ? "Generating…" : "Done for today — read the next passage →"}
          </button>
        </>
      )}
    </div>
  );
}
