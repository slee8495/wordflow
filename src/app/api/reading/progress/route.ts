import { NextRequest, NextResponse } from "next/server";
import { getReadingProgress } from "@/lib/progress";
import { authErrorResponse, requireEntitledProfile } from "@/lib/authProfile";

export async function GET(req: NextRequest) {
  const scopeParam = req.nextUrl.searchParams.get("scope");
  const scope = scopeParam === "all" ? "all" : "cycle";

  try {
    const profile = await requireEntitledProfile();
    const progress = await getReadingProgress(profile, scope);
    return NextResponse.json({ progress });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to load progress", detail: message }, { status: 500 });
  }
}
