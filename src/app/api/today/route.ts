import { NextRequest, NextResponse } from "next/server";
import { findOrCreateProfile, getTodayReadings } from "@/lib/generateReading";

export const maxDuration = 60;

// Returns every reading generated for a name-based profile today (oldest first), generating
// the first one on first request of the day if the nightly cron hasn't run yet (or for local
// dev where no cron is configured). A profile can have more than one if they've read ahead via
// POST /api/today/next — the UI pages back and forth through the list.
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  try {
    const profile = await findOrCreateProfile(name);
    const readings = await getTodayReadings(profile);
    return NextResponse.json({ readings });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to load today's reading", detail: message }, { status: 500 });
  }
}
