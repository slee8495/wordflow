import type { VercelConfig } from "@vercel/config/v1";

// No crons: today's reading is generated lazily, the first time a profile actually opens the
// app or asks the chat assistant about it (see generateDailyReading in src/lib/generateReading.ts).
// A nightly cron used to pre-generate it for every profile regardless of whether they visited,
// which silently advanced the curriculum cursor on days someone never opened the app — skipping
// them past whatever they'd missed instead of picking back up where they left off.
export const config: VercelConfig = {
  framework: "nextjs",
};
