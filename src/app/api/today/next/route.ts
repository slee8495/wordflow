import { NextRequest, NextResponse } from "next/server";
import { findOrCreateProfile, generateNextReading, syncProfileTimezone } from "@/lib/generateReading";

// See src/app/api/today/route.ts for why this is 120 rather than 60 — the after()-scheduled
// background prefetch this triggers counts against the same ceiling as the request itself.
export const maxDuration = 120;

// User-triggered "read next" — always generates a fresh reading and advances the cursor, even
// if one already exists for today. Distinct from the idempotent GET /api/today.
export async function POST(req: NextRequest) {
  const { name, timezone } = await req.json().catch(() => ({ name: null, timezone: null }));
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const profile = await syncProfileTimezone(await findOrCreateProfile(name), timezone);
    const reading = await generateNextReading(profile);
    return NextResponse.json({ reading });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to generate the next reading", detail: message }, { status: 500 });
  }
}
