import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const [profile] = await db.select().from(profiles).where(eq(profiles.name, name)).limit(1);
  return NextResponse.json({ enabled: profile?.notificationsEnabled ?? false });
}
