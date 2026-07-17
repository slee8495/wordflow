import { tool } from "ai";
import { z } from "zod";
import { findOrCreateProfile, generateDailyReading } from "@/lib/generateReading";
import { searchWorshipSongs } from "@/lib/youtube";

export const getTodayReading = tool({
  description:
    "Get the user's reading for today (theme, story summary, historical context, personal message, passage text). Call this before answering anything about 'today's passage/reading'.",
  inputSchema: z.object({ name: z.string().describe("The user's profile name") }),
  execute: async ({ name }) => {
    const profile = await findOrCreateProfile(name);
    const reading = await generateDailyReading(profile);
    return reading;
  },
});

export const recommendWorship = tool({
  description: "Search YouTube for worship songs matching a mood, theme, or Bible passage.",
  inputSchema: z.object({ theme: z.string().describe("Theme, mood, or topic to find worship songs for") }),
  execute: async ({ theme }) => {
    const { ko, en } = await searchWorshipSongs(theme, theme);
    return [ko, en].filter((w): w is NonNullable<typeof w> => w !== null);
  },
});
