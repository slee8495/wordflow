"use client";

import { useEffect, useState } from "react";
import { splitIntoChunks } from "@/lib/speak";
import { formatPassageRefEnglish, formatPassageRefKorean } from "@/lib/passageRef";
import { greeting, passageOfLabel, type UiStringKey } from "@/lib/i18n";
import { usePlayback } from "./PlaybackProvider";
import { useTimezone } from "./TimezoneProvider";
import { useUiLanguage } from "./UiLanguageProvider";
import { useUser } from "./UserProvider";

const LANG_KEY = "wordflow:lang";
const sectionSourceId = (id: string) => `today-${id}`;

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
  passageTextEnStory: string | null;
  passageRef: string | null;
  worshipLinkKo: WorshipLink | null;
  worshipLinkEn: WorshipLink | null;
};

type SpeakState = "loading" | "playing" | "paused";

// Renders text as per-sentence spans, highlighting the one currently being read aloud when this
// section is the active speaker. Clicking a sentence jumps playback to it.
function HighlightedText({
  text,
  isActiveSection,
  activeChunkIndex,
  onSentenceClick,
}: {
  text: string;
  isActiveSection: boolean;
  activeChunkIndex: number | null;
  onSentenceClick: (index: number) => void;
}) {
  const chunks = splitIntoChunks(text);
  return (
    <p className="text-sm leading-relaxed whitespace-pre-line">
      {chunks.map((chunk, i) => (
        <span
          key={i}
          role="button"
          tabIndex={0}
          onClick={() => onSentenceClick(i)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSentenceClick(i);
            }
          }}
          className={
            isActiveSection && i === activeChunkIndex
              ? "cursor-pointer rounded bg-[var(--clay-deep)] font-semibold text-[var(--paper-raised)] transition-colors"
              : "cursor-pointer transition-colors hover:bg-[var(--clay-tint)]"
          }
        >
          {chunk}
          {i < chunks.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}

function Section({
  title,
  subtitle,
  children,
  onSpeak,
  speakState,
  onPauseToggle,
  onStop,
}: {
  title: string;
  subtitle?: string | null;
  children: React.ReactNode;
  onSpeak?: () => void;
  speakState?: SpeakState | null;
  onPauseToggle?: () => void;
  onStop?: () => void;
}) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--ink-soft)]">
          {title}
          {subtitle && <span className="ml-2 font-normal text-[var(--ink-soft)] opacity-70">{subtitle}</span>}
        </h2>
        {onSpeak &&
          (!speakState ? (
            <button onClick={onSpeak} className="text-base" aria-label={`Listen to ${title}`}>
              🔊
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onPauseToggle}
                disabled={speakState === "loading"}
                className="text-base disabled:opacity-50"
                aria-label={speakState === "paused" ? `Resume ${title}` : `Pause ${title}`}
              >
                {speakState === "loading" ? "…" : speakState === "paused" ? "▶️" : "⏸️"}
              </button>
              <button onClick={onStop} className="text-base" aria-label={`Stop ${title}`}>
                ⏹️
              </button>
            </div>
          ))}
      </div>
      {children}
    </section>
  );
}

export default function Home() {
  const { name, login, logout } = useUser();
  const { uiLang, t } = useUiLanguage();
  const { timezone } = useTimezone();
  const { sourceId, speakState: globalSpeakState, activeChunkIndex, playText, pause, resume, stop } = usePlayback();
  const [nameInput, setNameInput] = useState("");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UiStringKey | null>(null);
  const [passageView, setPassageView] = useState<"verses" | "story">("verses");
  const [contentLanguage, setContentLanguage] = useState<"ko" | "en">("ko");
  const [generatingNext, setGeneratingNext] = useState(false);

  function speakingSectionFor(id: string): { id: string; state: SpeakState } | null {
    return sourceId === sectionSourceId(id) && globalSpeakState ? { id, state: globalSpeakState } : null;
  }

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
    fetch(`/api/today?name=${encodeURIComponent(name)}&timezone=${encodeURIComponent(timezone)}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed to load today's reading");
        return res.json();
      })
      .then(({ readings }: { readings: Reading[] }) => {
        setReadings(readings);
        setIndex(readings.length - 1);
      })
      .catch(() => setError("errors.loadToday"))
      .finally(() => setLoading(false));
  }, [name, timezone]);

  function setLanguage(lang: "ko" | "en") {
    setContentLanguage(lang);
    localStorage.setItem(LANG_KEY, lang);
  }

  function speakSection(id: string, label: string, text: string | null, startIndex?: number) {
    if (!text?.trim()) return;
    playText(sectionSourceId(id), label, text, startIndex);
  }

  async function readNext() {
    if (!name || generatingNext) return;
    setGeneratingNext(true);
    setError(null);
    try {
      const res = await fetch("/api/today/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timezone }),
      });
      if (!res.ok) throw new Error("failed to generate the next reading");
      const { reading } = await res.json();
      setReadings((current) => [...current, reading]);
      setIndex((current) => current + 1);
      setPassageView("verses");
    } catch {
      setError("errors.loadNext");
    } finally {
      setGeneratingNext(false);
    }
  }

  const todayLabel = new Intl.DateTimeFormat(uiLang === "ko" ? "ko-KR" : "en-US", {
    timeZone: timezone,
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
        <p className="text-sm text-[var(--ink-soft)]">{t("login.prompt")}</p>
        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder={t("login.namePlaceholder")}
          className="rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--clay)]"
        />
        <button
          type="submit"
          className="rounded-lg bg-[var(--clay-deep)] px-3 py-2 text-sm font-medium text-[var(--paper-raised)]"
        >
          {t("login.start")}
        </button>
      </form>
    );
  }

  const reading = readings[index] ?? null;
  const pick = (en: string | null | undefined, ko: string) => (contentLanguage === "en" ? (en ?? ko) : ko);

  const passageText =
    contentLanguage === "en"
      ? ((passageView === "story" ? reading?.passageTextEnStory : reading?.passageTextEn) ??
        reading?.passageTextEnStory ??
        reading?.passageTextEn)
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
        <span className="text-sm text-[var(--ink-soft)]">{greeting(uiLang, name)}</span>
        <button
          onClick={() => {
            logout();
            setReadings([]);
          }}
          className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          {t("today.changeName")}
        </button>
      </div>

      {loading && <p className="text-sm text-[var(--ink-soft)]">{t("today.preparing")}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{t(error)}</p>}

      {readings.length > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] px-3 py-2">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--clay-tint)] disabled:opacity-30 disabled:hover:bg-transparent"
          >
            ← {t("today.previousPassage")}
          </button>
          <span className="text-xs text-[var(--ink-soft)]">{passageOfLabel(uiLang, index + 1, readings.length)}</span>
          <button
            onClick={() => setIndex((i) => Math.min(readings.length - 1, i + 1))}
            disabled={index === readings.length - 1}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--clay-tint)] disabled:opacity-30 disabled:hover:bg-transparent"
          >
            {t("today.nextPassage")} →
          </button>
        </div>
      )}

      {reading && (
        <>
          <div className="rounded-xl bg-[var(--clay-deep)] px-4 py-3 text-[var(--paper-raised)]">
            <h1 className="text-lg font-semibold">{pick(reading.themeEn, reading.theme)}</h1>
          </div>

          <Section
            title={t("today.contextTitle")}
            onSpeak={() =>
              speakSection("context", t("today.contextTitle"), pick(reading.historicalContextEn, reading.historicalContext))
            }
            speakState={speakingSectionFor("context")?.state ?? null}
            onPauseToggle={() => (globalSpeakState === "paused" ? resume() : pause())}
            onStop={stop}
          >
            <HighlightedText
              text={pick(reading.historicalContextEn, reading.historicalContext)}
              isActiveSection={sourceId === sectionSourceId("context")}
              activeChunkIndex={activeChunkIndex}
              onSentenceClick={(i) =>
                speakSection("context", t("today.contextTitle"), pick(reading.historicalContextEn, reading.historicalContext), i)
              }
            />
          </Section>

          {(reading.passageTextKoVerses || reading.passageTextKoStory || reading.passageTextEn) && (
            <Section
              title={t("today.passageTitle")}
              subtitle={rangeLabel}
              onSpeak={() => speakSection("passage", t("today.passageTitle"), passageText ?? null)}
              speakState={speakingSectionFor("passage")?.state ?? null}
              onPauseToggle={() => (globalSpeakState === "paused" ? resume() : pause())}
              onStop={stop}
            >
              <div className="mb-2 flex gap-1.5">
                <button
                  onClick={() => setPassageView("verses")}
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    passageView === "verses"
                      ? "bg-[var(--clay-deep)] text-[var(--paper-raised)]"
                      : "bg-[var(--clay-tint)] text-[var(--ink-soft)]"
                  }`}
                >
                  {t("today.byVerse")}
                </button>
                <button
                  onClick={() => setPassageView("story")}
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    passageView === "story"
                      ? "bg-[var(--clay-deep)] text-[var(--paper-raised)]"
                      : "bg-[var(--clay-tint)] text-[var(--ink-soft)]"
                  }`}
                >
                  {t("today.asStory")}
                </button>
              </div>
              {passageText && (
                <HighlightedText
                  text={passageText}
                  isActiveSection={sourceId === sectionSourceId("passage")}
                  activeChunkIndex={activeChunkIndex}
                  onSentenceClick={(i) => speakSection("passage", t("today.passageTitle"), passageText, i)}
                />
              )}
              <p className="mt-2 text-xs text-[var(--ink-soft)] opacity-70">
                {contentLanguage === "en"
                  ? passageView === "story"
                    ? "AI-adapted into story form, based on the NLT (New Living Translation)"
                    : "NLT (New Living Translation)"
                  : "AI가 영어 NLT 성경을 바탕으로 쉬운 한글로 다시 표현한 본문이에요 (개역개정 등 특정 번역본이 아니에요)."}
              </p>
            </Section>
          )}

          <Section
            title={t("today.messageTitle")}
            onSpeak={() =>
              speakSection("message", t("today.messageTitle"), pick(reading.personalMessageEn, reading.personalMessage))
            }
            speakState={speakingSectionFor("message")?.state ?? null}
            onPauseToggle={() => (globalSpeakState === "paused" ? resume() : pause())}
            onStop={stop}
          >
            <HighlightedText
              text={pick(reading.personalMessageEn, reading.personalMessage)}
              isActiveSection={sourceId === sectionSourceId("message")}
              activeChunkIndex={activeChunkIndex}
              onSentenceClick={(i) =>
                speakSection("message", t("today.messageTitle"), pick(reading.personalMessageEn, reading.personalMessage), i)
              }
            />
          </Section>

          {worshipLink && (
            <Section title={t("today.worshipTitle")}>
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
              {generatingNext ? t("today.generating") : t("today.doneReadNext")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
