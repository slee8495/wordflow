import { NextRequest, NextResponse } from "next/server";
import { findOrCreateProfile, getTodayReadings, syncProfileTimezone } from "@/lib/generateReading";

// Generous enough to cover the worst case where this request's own generation is synchronous
// (no prefetch buffer existed yet, ~30-40s observed) *and* the after()-scheduled background
// prefetch for the following reading runs to completion in the same invocation afterward —
// both count against this one ceiling. 60s clipped that combined case in production (Vercel
// Runtime Timeout Error) even though the response itself had already been sent.
export const maxDuration = 120;

// Returns every reading generated for a name-based profile today (oldest first), generating the
// first one on first request of the day (there's no background job pre-generating it). A profile
// can have more than one if they've read ahead via POST /api/today/next — the UI pages back and
// forth through the list.
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  const timezone = req.nextUrl.searchParams.get("timezone");
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  try {
    const profile = await syncProfileTimezone(await findOrCreateProfile(name), timezone);
    const readings = await getTodayReadings(profile);
    return NextResponse.json({ readings });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to load today's reading", detail: message }, { status: 500 });
  }
}
