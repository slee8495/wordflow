import { NextRequest, NextResponse } from "next/server";
import { getReadingsForDate } from "@/lib/generateReading";
import { authErrorResponse, requireEntitledProfile } from "@/lib/authProfile";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Read-only lookup of a signed-in profile's readings for an arbitrary date, for the Today tab's
// day-by-day history navigation. Unlike /api/today, never generates anything — a date the profile
// never visited simply returns an empty array.
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "invalid or missing date" }, { status: 400 });
  }

  try {
    const profile = await requireEntitledProfile();
    const readings = await getReadingsForDate(profile, date);
    return NextResponse.json({ readings });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to load reading history", detail: message }, { status: 500 });
  }
}
