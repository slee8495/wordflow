import type { VercelConfig } from "@vercel/config/v1";

// Today's reading is still generated lazily — the one cron below (the morning reminder) is
// read-only with respect to the curriculum: it only peeks at each profile's current cursor
// position via peekCurrentCurriculumItem to compose the notification text, and never calls
// generateDailyReading/buildReading. A previous nightly cron used to pre-generate today's
// reading for every profile regardless of whether they visited, which silently advanced the
// curriculum cursor on days someone never opened the app — skipping them past whatever they'd
// missed instead of picking back up where they left off. See src/app/api/notifications/cron.
//
// Hobby-plan Vercel accounts only allow daily (not sub-daily) cron schedules, so this can't poll
// every 15 minutes to find "5am Pacific" precisely across DST the way a Pro plan could. 12:00
// UTC is exact during PDT (most of the year, roughly March-November); during PST it lands at
// 4am Pacific instead of 5am. The route itself sanity-checks the actual Pacific hour against a
// generous window (rather than requiring exactly 5) so a stray manual trigger at the wrong time
// of day doesn't notify everyone, while still tolerating that seasonal one-hour DST offset.
export const config: VercelConfig = {
  framework: "nextjs",
  crons: [{ path: "/api/notifications/cron", schedule: "0 12 * * *" }],
};
