"use client";

import { useEffect, useState } from "react";
import { speak } from "@/lib/speak";
import { BIBLE_BOOKS } from "@/lib/bibleBooks";
import { KOREAN_BOOK_ABBREV, ENGLISH_BOOK_ABBREV } from "@/lib/passageRef";
import { useUser } from "../UserProvider";

const LANG_KEY = "wordflow:lang";

// Sequential magnitude color for the two headline meters (books touched, current book) — a
// single clay hue, track uses a precomputed tint rather than alpha-over-paper (alpha blending
// pushed the red channel forward and read as pink; a computed tint stays warm and muted).
const METER_FILL = "bg-[var(--clay)]";
const METER_TRACK = "bg-[var(--clay-tint)]";
const CARD = "rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-4 shadow-sm";

type ProgressScope = "cycle" | "all";

type ProgressPayload = {
  scope: ProgressScope;
  cycleStartedAt: string | null;
  cycleCount: number;
  booksTouchedCount: number;
  booksProgressPct: number;
  currentBook: string | null;
  currentBookChaptersTouched: number | null;
  currentBookTotalChapters: number | null;
  currentBookProgressPct: number | null;
  projectedCompletionDate: string | null;
  perBookProgress: { book: string; testament: "old" | "new"; chaptersTouched: number; totalChapters: number; pct: number }[];
  activityCount: number;
};

function StatTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-3">
      <p className="text-xs text-[var(--ink-soft)]">
        {icon} {label}
      </p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Meter({ icon, label, pct, sublabel }: { icon: string; label: string; pct: number; sublabel: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-[var(--ink)]">
          {icon} {label}
        </span>
        <span className="text-[var(--ink-soft)]">{sublabel}</span>
      </div>
      <div className={`h-2 w-full overflow-hidden rounded-full ${METER_TRACK}`}>
        <div
          className={`h-full rounded-full ${METER_FILL}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

// Per-book bars use gold rather than the headline meters' clay, so the two big "how am I doing
// overall" meters stay visually distinct from the 66-row detail list below them; a fully read
// book switches to moss green as a quiet "done" signal.
function BookBar({
  label,
  chaptersTouched,
  totalChapters,
}: {
  label: string;
  chaptersTouched: number;
  totalChapters: number;
}) {
  const pct = totalChapters > 0 ? (chaptersTouched / totalChapters) * 100 : 0;
  const done = totalChapters > 0 && chaptersTouched >= totalChapters;
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-xs text-[var(--ink-soft)]">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--gold-tint)]">
        <div
          className={`h-full rounded-full ${done ? "bg-[var(--good)]" : "bg-[var(--gold)]"}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs text-[var(--ink-soft)] tabular-nums">
        {chaptersTouched}/{totalChapters}
      </span>
    </div>
  );
}

const SCOPE_OPTIONS: { label: string; scope: ProgressScope }[] = [
  { label: "This cycle", scope: "cycle" },
  { label: "All time", scope: "all" },
];

function ProgressDashboard({ name, lang }: { name: string; lang: "ko" | "en" }) {
  const [scope, setScope] = useState<ProgressScope>("cycle");
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch(`/api/reading/progress?name=${encodeURIComponent(name)}&scope=${scope}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed to load progress");
        return res.json();
      })
      .then(({ progress }) => setProgress(progress))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [name, scope]);

  if (loading && !progress) return <p className="text-sm text-[var(--ink-soft)]">Loading progress…</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!progress) return null;

  const abbrev = lang === "en" ? ENGLISH_BOOK_ABBREV : KOREAN_BOOK_ABBREV;
  const started = progress.currentBook !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon="🔄" label="Cycles completed" value={String(progress.cycleCount)} />
        <StatTile
          icon="🗓️"
          label="Projected completion"
          value={progress.projectedCompletionDate ?? "Not enough data yet"}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--ink-soft)]">Showing:</span>
        <div className="flex gap-1 rounded-full bg-[var(--clay-tint)] p-0.5 text-xs">
          {SCOPE_OPTIONS.map((s) => (
            <button
              key={s.scope}
              onClick={() => setScope(s.scope)}
              className={`rounded-full px-2 py-1 ${
                scope === s.scope
                  ? "bg-[var(--paper-raised)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--ink-soft)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {started ? (
        <section className={`flex flex-col gap-3 ${CARD}`}>
          <Meter
            icon="📚"
            label="Books touched"
            pct={progress.booksProgressPct}
            sublabel={`${progress.booksTouchedCount}/66 books`}
          />
          <Meter
            icon="📖"
            label={`Currently in: ${progress.currentBook}`}
            pct={progress.currentBookProgressPct ?? 0}
            sublabel={`${progress.currentBookChaptersTouched ?? 0}/${progress.currentBookTotalChapters ?? "?"} chapters`}
          />
        </section>
      ) : (
        <p className="text-sm text-[var(--ink-soft)]">Start reading to see your progress here.</p>
      )}

      <section className={CARD}>
        <h2 className="mb-3 text-sm font-semibold text-[var(--ink-soft)]">
          🔥 {progress.activityCount} reading{progress.activityCount === 1 ? "" : "s"}{" "}
          {scope === "cycle" ? "this cycle" : "all time"}
        </h2>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-[var(--ink-soft)]">Old Testament</p>
          {progress.perBookProgress
            .filter((b) => b.testament === "old")
            .map((b) => (
              <BookBar
                key={b.book}
                label={abbrev[b.book] ?? b.book}
                chaptersTouched={b.chaptersTouched}
                totalChapters={b.totalChapters}
              />
            ))}
          <p className="mt-2 text-xs font-medium text-[var(--ink-soft)]">New Testament</p>
          {progress.perBookProgress
            .filter((b) => b.testament === "new")
            .map((b) => (
              <BookBar
                key={b.book}
                label={abbrev[b.book] ?? b.book}
                chaptersTouched={b.chaptersTouched}
                totalChapters={b.totalChapters}
              />
            ))}
        </div>
      </section>
    </div>
  );
}

function BookGrid({
  testament,
  title,
  lang,
  onPick,
}: {
  testament: "old" | "new";
  title: string;
  lang: "ko" | "en";
  onPick: (book: string) => void;
}) {
  const abbrev = lang === "en" ? ENGLISH_BOOK_ABBREV : KOREAN_BOOK_ABBREV;
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-[var(--ink-soft)]">{title}</h2>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
        {BIBLE_BOOKS.filter((b) => b.testament === testament).map((b) => (
          <button
            key={b.name}
            onClick={() => onPick(b.name)}
            title={b.name}
            className="rounded-lg border border-[var(--line)] bg-[var(--paper-raised)] py-2 text-xs font-medium hover:border-[var(--clay)]"
          >
            {abbrev[b.name] ?? b.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReadingPage() {
  const { name, login } = useUser();
  const [nameInput, setNameInput] = useState("");
  const [contentLanguage, setContentLanguage] = useState<"ko" | "en">("ko");
  const [subTab, setSubTab] = useState<"browse" | "progress">("browse");
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [passageText, setPassageText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const storedLang = localStorage.getItem(LANG_KEY);
    if (storedLang === "en" || storedLang === "ko") setContentLanguage(storedLang);
  }, []);

  useEffect(() => {
    if (!selectedBook || !selectedChapter || !name) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setPassageText(null);
    fetch(
      `/api/reading/passage?book=${encodeURIComponent(selectedBook)}&chapter=${selectedChapter}&lang=${contentLanguage}&name=${encodeURIComponent(name)}`,
    )
      .then((res) => {
        if (!res.ok) throw new Error("failed to load passage");
        return res.json();
      })
      .then(({ content }) => setPassageText(content))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [selectedBook, selectedChapter, contentLanguage, name]);

  function setLanguage(lang: "ko" | "en") {
    setContentLanguage(lang);
    localStorage.setItem(LANG_KEY, lang);
  }

  const book = BIBLE_BOOKS.find((b) => b.name === selectedBook) ?? null;

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-full bg-[var(--clay-tint)] p-0.5 text-xs">
          <button
            onClick={() => setSubTab("browse")}
            className={`rounded-full px-3 py-1 font-medium ${
              subTab === "browse"
                ? "bg-[var(--paper-raised)] text-[var(--ink)] shadow-sm"
                : "text-[var(--ink-soft)]"
            }`}
          >
            Browse
          </button>
          <button
            onClick={() => setSubTab("progress")}
            className={`rounded-full px-3 py-1 font-medium ${
              subTab === "progress"
                ? "bg-[var(--paper-raised)] text-[var(--ink)] shadow-sm"
                : "text-[var(--ink-soft)]"
            }`}
          >
            Progress
          </button>
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

      {subTab === "progress" && <ProgressDashboard name={name} lang={contentLanguage} />}

      {subTab === "browse" && !selectedBook && (
        <div className="flex flex-col gap-4">
          <BookGrid testament="old" title="Old Testament" lang={contentLanguage} onPick={setSelectedBook} />
          <BookGrid testament="new" title="New Testament" lang={contentLanguage} onPick={setSelectedBook} />
        </div>
      )}

      {subTab === "browse" && selectedBook && !selectedChapter && book && (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setSelectedBook(null)}
            className="self-start text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            ← Books
          </button>
          <h2 className="text-sm font-semibold">{selectedBook}</h2>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {Array.from({ length: book.chapters }, (_, i) => i + 1).map((c) => (
              <button
                key={c}
                onClick={() => setSelectedChapter(c)}
                className="rounded-lg border border-[var(--line)] bg-[var(--paper-raised)] py-2 text-xs font-medium hover:border-[var(--clay)]"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {subTab === "browse" && selectedBook && selectedChapter && (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setSelectedChapter(null)}
            className="self-start text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            ← {selectedBook}
          </button>
          <section className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--ink-soft)]">
                {selectedBook} {selectedChapter}
              </h2>
              {passageText && (
                <button
                  onClick={async () => {
                    setSpeaking(true);
                    await speak(passageText);
                    setSpeaking(false);
                  }}
                  disabled={speaking}
                  className="text-base disabled:opacity-50"
                  aria-label={`Listen to ${selectedBook} ${selectedChapter}`}
                >
                  {speaking ? "…" : "🔊"}
                </button>
              )}
            </div>
            {loading && <p className="text-sm text-[var(--ink-soft)]">Loading…</p>}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {passageText && <p className="text-sm leading-relaxed whitespace-pre-line">{passageText}</p>}
          </section>
        </div>
      )}
    </div>
  );
}
