import { NextRequest, NextResponse } from "next/server";
import { findOrCreateProfile, generateDailyReading } from "@/lib/generateReading";

export const maxDuration = 60;

// Returns today's reading for a name-based profile, generating it on first request of the day
// if the nightly cron hasn't run yet (or for local dev where no cron is configured).
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  try {
    const profile = await findOrCreateProfile(name);
    const reading = await generateDailyReading(profile);
    return NextResponse.json({ reading });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to load today's reading", detail: message }, { status: 500 });
  }
}
