"use client";

import { useEffect, useState } from "react";
import { speak } from "@/lib/speak";
import { formatPassageRefEnglish, formatPassageRefKorean } from "@/lib/passageRef";
import { useUser } from "./UserProvider";

const LANG_KEY = "wordflow:lang";

type WorshipLink = { title: string; url: string };
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
  worshipLinkKo: WorshipLink | null;
  worshipLinkEn: WorshipLink | null;
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
    <section className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--ink-soft)]">
          {title}
          {subtitle && <span className="ml-2 font-normal text-[var(--ink-soft)] opacity-70">{subtitle}</span>}
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
  const { name, login, logout } = useUser();
  const [nameInput, setNameInput] = useState("");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passageView, setPassageView] = useState<"verses" | "story">("verses");
  const [contentLanguage, setContentLanguage] = useState<"ko" | "en">("ko");
  const [speakingSection, setSpeakingSection] = useState<string | null>(null);
  const [generatingNext, setGeneratingNext] = useState(false);

  useEffect(() => {
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
      .then(({ readings }: { readings: Reading[] }) => {
        setReadings(readings);
        setIndex(readings.length - 1);
      })
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
      setReadings((current) => [...current, reading]);
      setIndex((current) => current + 1);
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
          login(nameInput);
        }}
      >
        <p className="text-sm text-[var(--ink-soft)]">Enter your name to save your reading progress.</p>
        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Name"
          className="rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--clay)]"
        />
        <button
          type="submit"
          className="rounded-lg bg-[var(--clay-deep)] px-3 py-2 text-sm font-medium text-[var(--paper-raised)]"
        >
          Start
        </button>
      </form>
    );
  }

  const reading = readings[index] ?? null;
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

  const worshipLink = reading ? (contentLanguage === "en" ? reading.worshipLinkEn : reading.worshipLinkKo) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--ink-soft)]">{todayLabel}</span>
        <div className="flex gap-1 rounded-full bg-[var(--clay-tint)] p-0.5 text-xs">
          <button
            onClick={() => setLanguage("ko")}
            className={`rounded-full px-2 py-1 ${
              contentLanguage === "ko"
                ? "bg-[var(--paper-raised)] text-[var(--ink)] shadow-sm"
                : "text-[var(--ink-soft)]"
            }`}
          >
            한글
          </button>
          <button
            onClick={() => setLanguage("en")}
            className={`rounded-full px-2 py-1 ${
              contentLanguage === "en"
                ? "bg-[var(--paper-raised)] text-[var(--ink)] shadow-sm"
                : "text-[var(--ink-soft)]"
            }`}
          >
            English
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--ink-soft)]">Hi {name} — today&apos;s reading</span>
        <button
          onClick={() => {
            logout();
            setReadings([]);
          }}
          className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          Change name
        </button>
      </div>

      {loading && <p className="text-sm text-[var(--ink-soft)]">Preparing today&apos;s reading…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {readings.length > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] px-3 py-2">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--clay-tint)] disabled:opacity-30 disabled:hover:bg-transparent"
          >
            ← Previous passage
          </button>
          <span className="text-xs text-[var(--ink-soft)]">
            Passage {index + 1} of {readings.length} today
          </span>
          <button
            onClick={() => setIndex((i) => Math.min(readings.length - 1, i + 1))}
            disabled={index === readings.length - 1}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--clay-tint)] disabled:opacity-30 disabled:hover:bg-transparent"
          >
            Next passage →
          </button>
        </div>
      )}

      {reading && (
        <>
          <div className="rounded-xl bg-[var(--clay-deep)] px-4 py-3 text-[var(--paper-raised)]">
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
                        ? "bg-[var(--clay-deep)] text-[var(--paper-raised)]"
                        : "bg-[var(--clay-tint)] text-[var(--ink-soft)]"
                    }`}
                  >
                    By Verse
                  </button>
                  <button
                    onClick={() => setPassageView("story")}
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      passageView === "story"
                        ? "bg-[var(--clay-deep)] text-[var(--paper-raised)]"
                        : "bg-[var(--clay-tint)] text-[var(--ink-soft)]"
                    }`}
                  >
                    As a Story
                  </button>
                </div>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-line">{passageText}</p>
              <p className="mt-2 text-xs text-[var(--ink-soft)] opacity-70">
                {contentLanguage === "en"
                  ? "NLT (New Living Translation)"
                  : "AI가 영어 NLT 성경을 바탕으로 쉬운 한글로 다시 표현한 본문이에요 (개역개정 등 특정 번역본이 아니에요)."}
              </p>
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

          {worshipLink && (
            <Section title="Worship">
              <a
                href={worshipLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--clay-deep)] hover:underline"
              >
                🎵 {worshipLink.title}
              </a>
            </Section>
          )}

          {index === readings.length - 1 && (
            <button
              onClick={readNext}
              disabled={generatingNext}
              className="rounded-lg border border-dashed border-[var(--line)] px-3 py-2 text-sm text-[var(--ink-soft)] hover:border-[var(--clay)] hover:text-[var(--ink)] disabled:opacity-50"
            >
              {generatingNext ? "Generating…" : "Done for today — read the next passage →"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
