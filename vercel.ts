import type { VercelConfig } from "@vercel/config/v1";

// Today's reading is still generated lazily — the one cron below (the morning reminder) is
// read-only with respect to the curriculum: it only peeks at each profile's current cursor
// position via peekCurrentCurriculumItem to compose the notification text, and never calls
// generateDailyReading/buildReading. A previous nightly cron used to pre-generate today's
// reading for every profile regardless of whether they visited, which silently advanced the
// curriculum cursor on days someone never opened the app — skipping them past whatever they'd
// missed instead of picking back up where they left off. See src/app/api/notifications/cron.
//
// Scheduled every 15 minutes rather than once at a fixed UTC time: Vercel cron schedules are
// UTC-only, and a fixed offset for "5am Pacific" would drift an hour twice a year across DST.
// The route itself checks the actual Pacific wall-clock hour and a per-profile lastNotifiedDate
// guard, so only the first invocation on/after 5am each day does anything.
export const config: VercelConfig = {
  framework: "nextjs",
  crons: [{ path: "/api/notifications/cron", schedule: "*/15 * * * *" }],
};
