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
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const testamentEnum = pgEnum("testament", ["old", "new"]);

// Auth.js (NextAuth v5) schema, shaped exactly as @auth/drizzle-adapter expects — table/column
// names matter here, this isn't just app convention. Session strategy is JWT (see auth.ts), so
// the `sessions` table isn't actually read/written by Auth.js itself, but the adapter still
// requires it to exist. `users`/`accounts` are what's actually used: one `users` row per person,
// one `accounts` row per OAuth provider they've linked (Google now, Apple later — same user can
// have both once Apple's added).
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),

  // --- Stripe billing ($3.99/mo, 7-day trial via Stripe Checkout) ---
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  // Mirrors the Stripe Subscription object's own `status` (trialing/active/past_due/canceled/...)
  // — only ever written by the /api/billing/webhook handler, never computed locally, so it always
  // reflects Stripe's source of truth.
  subscriptionStatus: varchar("subscription_status", { length: 32 }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),

  // --- Comp access, independent of Stripe (see src/lib/entitlement.ts) ---
  // Permanent free access, granted by redeeming FAMILY_PASSPHRASE in Settings.
  compFreeForever: boolean("comp_free_forever").default(false).notNull(),
  // Time-limited free access an admin can grant from /admin (e.g. a 1-year comp).
  compFreeUntil: date("comp_free_until"),

  // --- Family plan (see src/lib/family.ts) ---
  // "individual" | "family" | null — always derived fresh from the live Stripe subscription's
  // price id by the webhook handler, never trusted from Checkout-time intent. Gates whether this
  // user's family members inherit access from them (see resolveEntitlementDecision) — an owner
  // who downgrades to individual must stop covering former family members even though their own
  // subscriptionStatus is still "active".
  planType: varchar("plan_type", { length: 16 }),
  // Lazily generated on first invite-link request, regenerable by the owner to invalidate a
  // leaked link. Not tied to plan type — harmless to exist on a non-family-plan user, just unused.
  familyInviteToken: text("family_invite_token").unique(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// The ordered sequence of passages that every profile's cursor walks through — one entry per
// Bible chapter, in canonical book order (see curriculumData.ts), so a full cycle touches every
// chapter exactly once with no gaps and no overlaps. Loops back to orderIndex 0 once a profile's
// cursor passes the last row.
//
// Rows with season = 'legacy' are retired entries from the old ~50-item thematic-sampler
// curriculum (pre chapter-complete rebuild) — kept only so historical readings' curriculumItemId
// still resolves to their original passageRef; never part of the live rotation or any lookup.
//
// Season entries (season + seasonDayIndex set to "holy_week"/"christmas"/"thanksgiving") live in
// this same table but are NOT part of that rotation either — they use a separate orderIndex range
// (100000+, see seasonCurriculumData.ts) and every query that computes the normal cursor's
// curriculumLength or orderIndex range must filter `season IS NULL`, or a season/legacy row
// sharing a book name with a normal entry (e.g. both "Luke") would corrupt the per-book progress
// math. See src/lib/season.ts for the day-of-year lookup.
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

// `name` was the entire login mechanism pre-auth (anyone could type any existing name and see/
// edit that profile's data — a real gap now that this is heading toward a public launch, not just
// family use). userId links a profile to a real signed-in account (see src/auth.ts); null means
// "not claimed yet" — either a pre-auth profile nobody's linked to their new account yet, or one
// of the many throwaway test-profile rows from earlier development. Nullable and NOT unique-
// constrained (unlike `name`) since the claim flow looks up by name first, then attaches userId.
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  cursorPosition: integer("cursor_position").default(0).notNull(),
  // Increments each time cursorPosition wraps past the end of curriculum_items — how many full
  // read-through cycles this profile has completed.
  cycleCount: integer("cycle_count").default(0).notNull(),
  // Set on the very first reading ever, and reset every time cycleCount increments — lets the
  // progress dashboard scope "books touched" / per-book progress to just the current cycle
  // instead of only offering lifetime-cumulative numbers.
  currentCycleStartedAt: timestamp("current_cycle_started_at", { withTimezone: true }),
  lastReadDate: date("last_read_date"),
  // Synced from the client's UI-language setting (src/app/UiLanguageProvider.tsx) so server-side
  // code that has no request/session to read localStorage from — namely the morning-reminder
  // cron — can still compose the notification in the right language. Null until the client's
  // sync effect has run at least once; treat as the app's default UI language until then.
  uiLang: varchar("ui_lang", { length: 8 }),
  // IANA timezone name (e.g. "America/Los_Angeles", "Asia/Seoul") — the day boundary for this
  // profile's readings/forDate, season detection, and progress stats, and the reference zone for
  // notificationHour below. Auto-captured client-side from the browser on first load (see
  // ProfileSettingsSync.tsx), overridable in Settings. Null until synced at least once; every
  // read site falls back to DEFAULT_TIMEZONE (src/lib/date.ts) until then, preserving the
  // previous hardcoded-Pacific behavior for profiles that predate this column.
  timezone: varchar("timezone", { length: 64 }),
  // Hour of day (0-23) in the profile's own `timezone` to receive the morning reminder. Null
  // means "use DEFAULT_NOTIFICATION_HOUR" (see src/lib/date.ts), matching the original fixed-5am
  // behavior until a profile explicitly picks something else in Settings.
  notificationHour: integer("notification_hour"),
  // Whether the "today's reading is ready" push notification is turned on. Kept in sync with
  // whether any row exists in pushSubscriptions for this profile — true only once at least one
  // subscription has been saved, false again once the last one is removed.
  notificationsEnabled: boolean("notifications_enabled").default(false).notNull(),
  // Guards the cron against sending more than once per calendar day per profile — see
  // src/app/api/notifications/cron/route.ts. A date string in the profile's OWN timezone, same
  // convention as lastReadDate/forDate elsewhere (which are also now per-profile-timezone).
  lastNotifiedDate: date("last_notified_date"),

  // --- Resume-where-you-left-off bookmarks (see src/lib/bookmark.ts) ---
  // Reading tab's book/chapter browser: which book/chapter was last open, and the sentence-chunk
  // index playback last reached there. Restored on mount (auto-navigates past the book grid) and
  // used as the default startIndex the next time the speak button is pressed for that exact
  // book/chapter/lang — never auto-plays audio itself (browser autoplay policy, and simply
  // unwanted UX for something the user didn't ask to start).
  readingBookmark: jsonb("reading_bookmark").$type<{
    book: string;
    chapter: number;
    chunkIndex: number;
    lang: "ko" | "en";
  } | null>(),
  // Today tab's three sections (context/passage/message) share one slot — whichever was last
  // playing. `view` (verses/story) only applies when section is "passage".
  todayBookmark: jsonb("today_bookmark").$type<{
    section: "context" | "passage" | "message";
    chunkIndex: number;
    lang: "ko" | "en";
    view?: "verses" | "story";
  } | null>(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// One row per subscribed browser/device for the morning reminder push notification. A profile
// can have several (phone + laptop, etc). Deleted individually when that device unsubscribes, or
// automatically by the cron if the push service reports the subscription as gone (410/404).
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// One generated reading per profile per generation, created lazily on that profile's first
// visit of the day. Regenerated fresh each time even if the underlying passage repeats on a
// later loop through the curriculum, so the commentary/message isn't just replayed verbatim
// each cycle. No longer unique per (profileId, forDate) — a profile can request more than one
// reading on the same calendar day via the "read next"
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

  // Was varchar(128) — the model's "one-line theme" isn't reliably under 128 characters (English
  // themes in particular run long), and a Postgres varchar overflow (error 22001) failed the
  // whole insert/update. text has no such limit, matching the other generated fields below.
  theme: text("theme").notNull(),
  storySummary: text("story_summary").notNull(),
  historicalContext: text("historical_context").notNull(),
  personalMessage: text("personal_message").notNull(),

  // English counterparts of the four fields above, written in the same generateObject
  // call — lets the UI offer a content-language toggle independent of the passage text.
  themeEn: text("theme_en"),
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

  // false for a reading that's been generated ahead of time but not shown to the profile yet —
  // the one-item-deep prefetch buffer that makes "read next" instant instead of waiting on a
  // fresh generation. Excluded from every "today's readings" query until revealed() flips this
  // to true and restamps forDate to the date it's actually being shown on. Defaults true so
  // every pre-existing row (and any row inserted by code that doesn't know about prefetching,
  // e.g. catchUpReading) stays visible as before.
  revealed: boolean("revealed").default(true).notNull(),

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

// Fixed-window rate limiting (see src/lib/rateLimit.ts) — a small app doesn't need Redis/Upstash
// for this, a single upserted row per key does the job. `key` is caller-defined, e.g.
// "speak:203.0.113.4" or "passphrase:42" (profile id).
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

// One row per family-plan member (never one for the owner themselves — the owner is identified
// by having an active subscription with planType "family", not by a row here). memberUserId is
// UNIQUE so a person can only belong to one family at a time. The up-to-4-members cap is enforced
// at insert time under a Postgres advisory lock (see withFamilyLock in src/lib/family.ts) — a
// COUNT can't be expressed as a table constraint. Deleting a row (removal or self-leave) frees
// that slot immediately for someone else to be invited into.
export const familyMemberships = pgTable("family_memberships", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  memberUserId: text("member_user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type CurriculumItem = typeof curriculumItems.$inferSelect;
export type Reading = typeof readings.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type FamilyMembership = typeof familyMemberships.$inferSelect;
