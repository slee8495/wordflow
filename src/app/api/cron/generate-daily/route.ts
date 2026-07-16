import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cronAuth";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { generateDailyReading } from "@/lib/generateReading";

export const maxDuration = 300;

// Nightly batch: generates today's reading (and advances the cursor) for every profile that
// doesn't already have one for today. Safe to call more than once a day — generateDailyReading
// is idempotent per (profile, date).
export async function GET(req: NextRequest) {
  const unauthorized = requireCronAuth(req);
  if (unauthorized) return unauthorized;

  const allProfiles = await db.select().from(profiles);
  const results = await Promise.allSettled(allProfiles.map((p) => generateDailyReading(p)));

  const summary = results.map((r, i) => ({
    profile: allProfiles[i].name,
    status: r.status,
    error: r.status === "rejected" ? String(r.reason) : undefined,
  }));

  return NextResponse.json({ count: allProfiles.length, results: summary });
}
