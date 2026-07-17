import { NextRequest, NextResponse } from "next/server";
import { findOrCreateProfile } from "@/lib/generateReading";
import { getReadingProgress } from "@/lib/progress";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const scopeParam = req.nextUrl.searchParams.get("scope");
  const scope = scopeParam === "all" ? "all" : "cycle";

  try {
    const profile = await findOrCreateProfile(name);
    const progress = await getReadingProgress(profile, scope);
    return NextResponse.json({ progress });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to load progress", detail: message }, { status: 500 });
  }
}
