import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    // Runs daily at 13:00 UTC = ~6am Pacific (drifts ~1hr across DST) — generates today's
    // reading for every profile before the day starts, so it's ready the first time they open
    // the app. generateDailyReading is idempotent per (profile, date), so this is safe to
    // re-run manually too.
    { path: "/api/cron/generate-daily", schedule: "0 13 * * *" },
  ],
};
