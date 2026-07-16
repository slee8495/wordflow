import { NextRequest, NextResponse } from "next/server";

export function requireCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null; // no secret configured (local dev) — allow

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
