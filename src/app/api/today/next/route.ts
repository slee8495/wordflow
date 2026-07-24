import { NextRequest, NextResponse } from "next/server";
import { generateNextReading, syncProfileTimezone } from "@/lib/generateReading";
import { authErrorResponse, requireEntitledProfile } from "@/lib/authProfile";

// See src/app/api/today/route.ts for why this is 120 rather than 60 — the after()-scheduled
// background prefetch this triggers counts against the same ceiling as the request itself.
export const maxDuration = 120;

// User-triggered "read next" — always generates a fresh reading and advances the cursor, even
// if one already exists for today. Distinct from the idempotent GET /api/today.
export async function POST(req: NextRequest) {
  const { timezone } = await req.json().catch(() => ({ timezone: null }));

  try {
    const profile = await syncProfileTimezone(await requireEntitledProfile(), timezone);
    const reading = await generateNextReading(profile);
    return NextResponse.json({ reading });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to generate the next reading", detail: message }, { status: 500 });
  }
}
