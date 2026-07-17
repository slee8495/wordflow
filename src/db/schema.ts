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
} from "drizzle-orm/pg-core";

export const testamentEnum = pgEnum("testament", ["old", "new"]);

// The ordered, theme-curated sequence of passages that every profile's cursor walks through.
// Not book order — grouped by theme/season so day-to-day reading has narrative continuity.
// Loops back to orderIndex 0 once a profile's cursor passes the last row.
export const curriculumItems = pgTable("curriculum_items", {
  id: serial("id").primaryKey(),
  orderIndex: integer("order_index").notNull().unique(),
  theme: varchar("theme", { length: 128 }).notNull(),
  book: varchar("book", { length: 64 }).notNull(),
  passageRef: varchar("passage_ref", { length: 128 }).notNull(),
  testament: testamentEnum("testament").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type WorshipLink = { title: string; url: string };

// A lightweight name-based profile — no password/auth yet. `name` is the login.
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  cursorPosition: integer("cursor_position").default(0).notNull(),
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
  passageTextEn: text("passage_text_en"),

  // One worship pick per language, not a mixed list — the UI only ever shows the pick that
  // matches the active content-language toggle.
  worshipLinkKo: jsonb("worship_link_ko").$type<WorshipLink | null>(),
  worshipLinkEn: jsonb("worship_link_en").$type<WorshipLink | null>(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Profile = typeof profiles.$inferSelect;
export type CurriculumItem = typeof curriculumItems.$inferSelect;
export type Reading = typeof readings.$inferSelect;
