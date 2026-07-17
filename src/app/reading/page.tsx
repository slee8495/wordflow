"use client";

import { useEffect, useState } from "react";
import { speak } from "@/lib/speak";
import { BIBLE_BOOKS } from "@/lib/bibleBooks";
import { KOREAN_BOOK_ABBREV, ENGLISH_BOOK_ABBREV } from "@/lib/passageRef";

const NAME_KEY = "wordflow:name";
const LANG_KEY = "wordflow:lang";

// Sequential blue from the design system's validated palette — one hue for magnitude, constant
// across a bar chart where length (not lightness) already carries the value.
const METER_FILL = "bg-[#2a78d6] dark:bg-[#3987e5]";
const METER_TRACK = "bg-[#cde2fb] dark:bg-zinc-800";

type ProgressPayload = {
  cycleCount: number;
  booksTouchedCount: number;
  booksProgressPct: number;
  currentBook: string | null;
  currentBookChaptersTouched: number | null;
  currentBookTotalChapters: number | null;
  currentBookProgressPct: number | null;
  projectedCompletionDate: string | null;
  perBookProgress: { book: string; testament: "old" | "new"; chaptersTouched: number; totalChapters: number; pct: number }[];
  recentActivityCount: number;
  recentActivityDays: number;
};

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Meter({ label, pct, sublabel }: { label: string; pct: number; sublabel: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
        <span className="text-zinc-400">{sublabel}</span>
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
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className={`h-2 flex-1 overflow-hidden rounded-full ${METER_TRACK}`}>
        <div className={`h-full rounded-full ${METER_FILL}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs text-zinc-400 tabular-nums">
        {chaptersTouched}/{totalChapters}
      </span>
    </div>
  );
}

const DAY_FILTERS: { label: string; days: number }[] = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: 3650 },
];

function ProgressDashboard({ name, lang }: { name: string; lang: "ko" | "en" }) {
  const [days, setDays] = useState(30);
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch(`/api/reading/progress?name=${encodeURIComponent(name)}&days=${days}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed to load progress");
        return res.json();
      })
      .then(({ progress }) => setProgress(progress))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [name, days]);

  if (loading && !progress) return <p className="text-sm text-zinc-400">Loading progress…</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!progress) return null;

  const abbrev = lang === "en" ? ENGLISH_BOOK_ABBREV : KOREAN_BOOK_ABBREV;
  const started = progress.currentBook !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Cycles completed" value={String(progress.cycleCount)} />
        <StatTile
          label="Projected completion"
          value={progress.projectedCompletionDate ?? "Not enough data yet"}
        />
      </div>

      {started ? (
        <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <Meter
            label="Books touched"
            pct={progress.booksProgressPct}
            sublabel={`${progress.booksTouchedCount}/66 books`}
          />
          <Meter
            label={`Currently in: ${progress.currentBook}`}
            pct={progress.currentBookProgressPct ?? 0}
            sublabel={`${progress.currentBookChaptersTouched ?? 0}/${progress.currentBookTotalChapters ?? "?"} chapters`}
          />
        </section>
      ) : (
        <p className="text-sm text-zinc-400">Start reading to see your progress here.</p>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Activity — {progress.recentActivityCount} reading{progress.recentActivityCount === 1 ? "" : "s"}
          </h2>
          <div className="flex gap-1 rounded-full bg-zinc-100 p-0.5 text-xs dark:bg-zinc-800">
            {DAY_FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => setDays(f.days)}
                className={`rounded-full px-2 py-1 ${
                  days === f.days
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"
                    : "text-zinc-500"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-zinc-400">Old Testament</p>
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
          <p className="mt-2 text-xs font-medium text-zinc-400">New Testament</p>
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
      <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">{title}</h2>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
        {BIBLE_BOOKS.filter((b) => b.testament === testament).map((b) => (
          <button
            key={b.name}
            onClick={() => onPick(b.name)}
            title={b.name}
            className="rounded-lg border border-zinc-200 bg-white py-2 text-xs font-medium hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
          >
            {abbrev[b.name] ?? b.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReadingPage() {
  const [name, setName] = useState<string | null>(null);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(localStorage.getItem(NAME_KEY));
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-full bg-zinc-100 p-0.5 text-xs dark:bg-zinc-800">
          <button
            onClick={() => setSubTab("browse")}
            className={`rounded-full px-3 py-1 font-medium ${
              subTab === "browse"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"
                : "text-zinc-500"
            }`}
          >
            Browse
          </button>
          <button
            onClick={() => setSubTab("progress")}
            className={`rounded-full px-3 py-1 font-medium ${
              subTab === "progress"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"
                : "text-zinc-500"
            }`}
          >
            Progress
          </button>
        </div>
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
            className="self-start text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            ← Books
          </button>
          <h2 className="text-sm font-semibold">{selectedBook}</h2>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {Array.from({ length: book.chapters }, (_, i) => i + 1).map((c) => (
              <button
                key={c}
                onClick={() => setSelectedChapter(c)}
                className="rounded-lg border border-zinc-200 bg-white py-2 text-xs font-medium hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
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
            className="self-start text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            ← {selectedBook}
          </button>
          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
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
            {loading && <p className="text-sm text-zinc-400">Loading…</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
            {passageText && <p className="text-sm leading-relaxed whitespace-pre-line">{passageText}</p>}
          </section>
        </div>
      )}
    </div>
  );
}
