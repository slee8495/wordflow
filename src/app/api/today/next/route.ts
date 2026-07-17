import { NextRequest, NextResponse } from "next/server";
import { findOrCreateProfile, generateNextReading } from "@/lib/generateReading";

export const maxDuration = 60;

// User-triggered "read next" — always generates a fresh reading and advances the cursor, even
// if one already exists for today. Distinct from the idempotent GET /api/today.
export async function POST(req: NextRequest) {
  const { name } = await req.json().catch(() => ({ name: null }));
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const profile = await findOrCreateProfile(name);
    const reading = await generateNextReading(profile);
    return NextResponse.json({ reading });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to generate the next reading", detail: message }, { status: 500 });
  }
}
