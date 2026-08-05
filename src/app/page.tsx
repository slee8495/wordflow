"use client";

import { useEffect, useRef, useState } from "react";
import { splitIntoChunks } from "@/lib/speak";
import { saveBookmark } from "@/lib/bookmark";
import { dateStringInTimezone, shiftDateString } from "@/lib/date";
import { formatPassageRefEnglish, formatPassageRefKorean } from "@/lib/passageRef";
import { greeting, passageOfLabel, type UiStringKey } from "@/lib/i18n";
import { ChevronButton, ChevronIcon } from "./ChevronIcon";
import { AuthScreen } from "./AuthScreen";
import { LandingScreen } from "./LandingScreen";
import { PaywallScreen } from "./PaywallScreen";
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
  const { name, plan, todayBookmark, status } = useUser();
  const { uiLang, t } = useUiLanguage();
  const { timezone } = useTimezone();
  const { sourceId, speakState: globalSpeakState, activeChunkIndex, playText, pause, resume, stop } = usePlayback();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UiStringKey | null>(null);
  const [passageView, setPassageView] = useState<"verses" | "story">("verses");
  const [contentLanguage, setContentLanguage] = useState<"ko" | "en">("ko");
  const [generatingNext, setGeneratingNext] = useState(false);
  // null means "today" — the only mode that can generate new readings. Any other value is a past
  // date being browsed read-only via /api/reading/history.
  const [viewDate, setViewDate] = useState<string | null>(null);
  const todayDateString = dateStringInTimezone(timezone);
  const effectiveDate = viewDate ?? todayDateString;
  const isToday = viewDate === null;

  function speakingSectionFor(id: string): { id: string; state: SpeakState } | null {
    return sourceId === sectionSourceId(id) && globalSpeakState ? { id, state: globalSpeakState } : null;
  }

  // Saved chunk index only applies if it's for this exact section/language(/view, for passage) and
  // still falls within the current text's chunk count (content can get regenerated after a quality
  // fix, which would make an old index point at a different sentence or run past the end).
  function resumeIndexFor(section: "context" | "passage" | "message", text: string | null): number | undefined {
    if (!todayBookmark || !text || todayBookmark.section !== section || todayBookmark.lang !== contentLanguage) {
      return undefined;
    }
    if (section === "passage" && todayBookmark.view !== passageView) return undefined;
    return todayBookmark.chunkIndex < splitIntoChunks(text).length ? todayBookmark.chunkIndex : undefined;
  }

  // Mirrors activeChunkIndex without being a dependency of the autosave effect below — chunk index
  // changes roughly every sentence, which would otherwise tear down and rebuild the 15s interval
  // before it ever gets a chance to fire.
  const activeChunkIndexRef = useRef<number | null>(null);
  activeChunkIndexRef.current = activeChunkIndex;

  // Best-effort autosave of playback position: immediately on pause/stop, and periodically while
  // actively playing (covers someone who just closes the tab without pausing first).
  useEffect(() => {
    if (!sourceId?.startsWith("today-")) return;
    const section = sourceId.slice("today-".length) as "context" | "passage" | "message";
    const save = () => {
      if (activeChunkIndexRef.current === null) return;
      saveBookmark("today", {
        section,
        chunkIndex: activeChunkIndexRef.current,
        lang: contentLanguage,
        ...(section === "passage" ? { view: passageView } : {}),
      });
    };
    if (globalSpeakState === "paused" || globalSpeakState === null) {
      save();
      return;
    }
    if (globalSpeakState !== "playing") return;
    const interval = setInterval(save, 15000);
    return () => clearInterval(interval);
  }, [sourceId, globalSpeakState, contentLanguage, passageView]);

  useEffect(() => {
    const storedLang = localStorage.getItem(LANG_KEY);
    if (storedLang === "en" || storedLang === "ko") {
      setContentLanguage(storedLang);
    }
  }, []);

  useEffect(() => {
    if (!name || !plan?.hasAccess) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setPassageView("verses");
    const url =
      viewDate === null
        ? `/api/today?timezone=${encodeURIComponent(timezone)}`
        : `/api/reading/history?date=${viewDate}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("failed to load reading");
        return res.json();
      })
      .then(({ readings }: { readings: Reading[] }) => {
        setReadings(readings);
        setIndex(Math.max(0, readings.length - 1));
      })
      .catch(() => setError("errors.loadToday"))
      .finally(() => setLoading(false));
  }, [name, plan?.hasAccess, timezone, viewDate]);

  function goToPreviousDay() {
    setViewDate(shiftDateString(effectiveDate, -1));
  }

  function goToNextDay() {
    if (isToday) return;
    const next = shiftDateString(effectiveDate, 1);
    setViewDate(next >= todayDateString ? null : next);
  }

  function setLanguage(lang: "ko" | "en") {
    setContentLanguage(lang);
    localStorage.setItem(LANG_KEY, lang);
  }

  function speakSection(id: string, label: string, text: string | null, startIndex?: number) {
    if (!text?.trim()) return;
    playText(sectionSourceId(id), label, text, startIndex, contentLanguage);
  }

  async function readNext() {
    if (!name || generatingNext) return;
    setGeneratingNext(true);
    setError(null);
    try {
      const res = await fetch("/api/today/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
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

  // effectiveDate is always a resolved YYYY-MM-DD string (already the right calendar day in the
  // profile's timezone), so format it as an absolute date via UTC rather than re-applying a
  // timezone conversion on top, which would risk shifting it to the adjacent day.
  const [dayY, dayM, dayD] = effectiveDate.split("-").map(Number);
  const dayLabel = new Intl.DateTimeFormat(uiLang === "ko" ? "ko-KR" : "en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(dayY, dayM - 1, dayD)));

  if (status === "signedOut") {
    return <LandingScreen />;
  }
  if (name === null) {
    return <AuthScreen />;
  }
  if (!plan?.hasAccess) {
    return <PaywallScreen />;
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
        <div className="flex items-center gap-1">
          <ChevronButton direction="left" onClick={goToPreviousDay} ariaLabel={t("today.previousDay")} />
          <span className="text-sm text-[var(--ink-soft)]">{dayLabel}</span>
          <ChevronButton direction="right" onClick={goToNextDay} disabled={isToday} ariaLabel={t("today.nextDay")} />
        </div>
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

      <p className="text-sm text-[var(--ink-soft)]">{greeting(uiLang, name)}</p>

      {loading && <p className="text-sm text-[var(--ink-soft)]">{t("today.preparing")}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{t(error)}</p>}
      {!loading && !error && readings.length === 0 && (
        <p className="text-sm text-[var(--ink-soft)]">{t("today.noReadingThisDay")}</p>
      )}

      {readings.length > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] px-3 py-2">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--clay-tint)] disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronIcon direction="left" className="mr-1" /> {t("today.previousPassage")}
          </button>
          <span className="text-xs text-[var(--ink-soft)]">{passageOfLabel(uiLang, index + 1, readings.length)}</span>
          <button
            onClick={() => setIndex((i) => Math.min(readings.length - 1, i + 1))}
            disabled={index === readings.length - 1}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--clay-tint)] disabled:opacity-30 disabled:hover:bg-transparent"
          >
            {t("today.nextPassage")} <ChevronIcon direction="right" className="ml-1" />
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
            onSpeak={() => {
              const text = pick(reading.historicalContextEn, reading.historicalContext);
              speakSection("context", t("today.contextTitle"), text, resumeIndexFor("context", text));
            }}
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
              onSpeak={() => speakSection("passage", t("today.passageTitle"), passageText ?? null, resumeIndexFor("passage", passageText ?? null))}
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
            onSpeak={() => {
              const text = pick(reading.personalMessageEn, reading.personalMessage);
              speakSection("message", t("today.messageTitle"), text, resumeIndexFor("message", text));
            }}
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

          {isToday && index === readings.length - 1 && (
            <button
              onClick={readNext}
              disabled={generatingNext}
              className="rounded-lg border border-dashed border-[var(--line)] px-3 py-2 text-sm text-[var(--ink-soft)] hover:border-[var(--clay)] hover:text-[var(--ink)] disabled:opacity-50"
            >
              {generatingNext ? (
                t("today.generating")
              ) : (
                <>
                  {t("today.doneReadNext")} <ChevronIcon direction="right" className="ml-1" />
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
