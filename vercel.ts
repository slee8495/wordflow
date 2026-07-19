import type { VercelConfig } from "@vercel/config/v1";

// Today's reading is still generated lazily — /api/notifications/cron (the morning reminder) is
// read-only with respect to the curriculum: it only peeks at each profile's current cursor
// position via peekCurrentCurriculumItem, and never calls generateDailyReading/buildReading. A
// previous nightly cron used to pre-generate today's reading for every profile regardless of
// whether they visited, which silently advanced the curriculum cursor on days someone never
// opened the app — skipping them past whatever they'd missed instead of picking back up where
// they left off.
//
// No `crons` entry here: each profile now has their own timezone + chosen notification hour, so
// the reminder needs to poll every ~15 minutes to catch each one at the right local moment —
// Hobby-plan Vercel accounts only allow daily (not sub-daily) Cron schedules, which can't do that.
// Instead .github/workflows/morning-reminder-cron.yml (a free GitHub Actions schedule) pings
// /api/notifications/cron every 15 minutes; the route itself checks each profile's own local
// hour and a lastNotifiedDate guard, so this is safe to over-trigger.
export const config: VercelConfig = {
  framework: "nextjs",
};
