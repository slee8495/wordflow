import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  date,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";

export const testamentEnum = pgEnum("testament", ["old", "new"]);

// The ordered, theme-curated sequence of passages that every profile's cursor walks through.
// Not book order — grouped by theme so day-to-day reading has narrative continuity. Loops back
// to orderIndex 0 once a profile's cursor passes the last row.
//
// Season entries (season + seasonDayIndex set) live in this same table but are NOT part of that
// rotation — they use a separate orderIndex range (1000+, see seasonCurriculumData.ts) and every
// query that computes the normal cursor's curriculumLength or orderIndex range must filter
// `season IS NULL`, or a season row sharing a book name with a normal entry (e.g. both "Luke")
// would corrupt the per-book progress math. See src/lib/season.ts for the day-of-year lookup.
export const curriculumItems = pgTable("curriculum_items", {
  id: serial("id").primaryKey(),
  orderIndex: integer("order_index").notNull().unique(),
  theme: varchar("theme", { length: 128 }).notNull(),
  book: varchar("book", { length: 64 }).notNull(),
  passageRef: varchar("passage_ref", { length: 128 }).notNull(),
  testament: testamentEnum("testament").notNull(),
  season: varchar("season", { length: 32 }), // "holy_week" | "christmas" | "thanksgiving" | null
  seasonDayIndex: integer("season_day_index"), // 0-indexed day within that season, null if season is null
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type WorshipLink = { title: string; url: string };

// A lightweight name-based profile — no password/auth yet. `name` is the login.
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  cursorPosition: integer("cursor_position").default(0).notNull(),
  // Increments each time cursorPosition wraps past the end of curriculum_items — how many full
  // read-through cycles this profile has completed.
  cycleCount: integer("cycle_count").default(0).notNull(),
  // Set on the very first reading ever, and reset every time cycleCount increments — lets the
  // progress dashboard scope "books touched" / per-book progress to just the current cycle
  // instead of only offering lifetime-cumulative numbers.
  currentCycleStartedAt: timestamp("current_cycle_started_at", { withTimezone: true }),
  lastReadDate: date("last_read_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// One generated reading per profile per generation. Regenerated fresh by the nightly cron even
// if the underlying passage repeats on a later loop through the curriculum, so the commentary/
// message isn't just replayed verbatim each cycle. No longer unique per (profileId, forDate) —
// a profile can request more than one reading on the same calendar day via the "read next"
// button, which always advances the cursor; /api/today shows the most recent one for today.
export const readings = pgTable("readings", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  curriculumItemId: integer("curriculum_item_id")
    .notNull()
    .references(() => curriculumItems.id),
  forDate: date("for_date").notNull(),

  theme: varchar("theme", { length: 128 }).notNull(),
  storySummary: text("story_summary").notNull(),
  historicalContext: text("historical_context").notNull(),
  personalMessage: text("personal_message").notNull(),

  // English counterparts of the four fields above, written in the same generateObject
  // call — lets the UI offer a content-language toggle independent of the passage text.
  themeEn: varchar("theme_en", { length: 128 }),
  storySummaryEn: text("story_summary_en"),
  historicalContextEn: text("historical_context_en"),
  personalMessageEn: text("personal_message_en"),

  // Claude-rendered Korean text (no reliable Bible API for 새번역 — see src/lib/bible.ts),
  // kept in both a verse-numbered form and a continuous-story form so the UI can offer either.
  passageTextKoVerses: text("passage_text_ko_verses"),
  passageTextKoStory: text("passage_text_ko_story"),
  // English verse-numbered text comes straight from the NLT API. passageTextEnStory is a
  // Claude-rendered continuous-prose rendition of that same NLT text (no new content, just
  // verse markers removed and flowed into prose) so the English side offers the same
  // by-verse/story toggle as Korean. Null on rows generated before this field existed.
  passageTextEn: text("passage_text_en"),
  passageTextEnStory: text("passage_text_en_story"),

  // One worship pick per language, not a mixed list — the UI only ever shows the pick that
  // matches the active content-language toggle.
  worshipLinkKo: jsonb("worship_link_ko").$type<WorshipLink | null>(),
  worshipLinkEn: jsonb("worship_link_en").$type<WorshipLink | null>(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// One row per profile/book/chapter/day a chapter was viewed in the Reading tab's book/chapter
// browser (통독) — deduped per day so repeated views in one sitting don't inflate the progress
// dashboard's activity counts. Feeds the same per-book/pace analytics as `readings`.
export const deepReadingLogs = pgTable("deep_reading_logs", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  book: varchar("book", { length: 64 }).notNull(),
  chapter: integer("chapter").notNull(),
  forDate: date("for_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Lazy, shared cache for Reading-tab chapter text — a chapter is fetched/generated once (NLT
// for English, Claude-rendered for Korean since there's no working Korean Bible API) and reused
// by every profile after that, both to respect the NLT API's quota and to avoid re-paying for
// Claude generation on every view.
export const bibleTextCache = pgTable(
  "bible_text_cache",
  {
    id: serial("id").primaryKey(),
    translation: varchar("translation", { length: 16 }).notNull(), // "nlt-en" | "claude-ko"
    book: varchar("book", { length: 64 }).notNull(),
    chapter: integer("chapter").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.translation, t.book, t.chapter)],
);

export type Profile = typeof profiles.$inferSelect;
export type CurriculumItem = typeof curriculumItems.$inferSelect;
export type Reading = typeof readings.$inferSelect;
