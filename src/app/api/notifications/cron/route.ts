import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, pushSubscriptions } from "@/db/schema";
import { peekCurrentCurriculumItem } from "@/lib/generateReading";
import { pacificDateString, pacificHour } from "@/lib/date";
import { formatPassageRefEnglish, formatPassageRefKorean } from "@/lib/passageRef";
import { getWebPush } from "@/lib/webPush";

export const maxDuration = 60;

// Runs once daily at a fixed UTC time (see vercel.ts — Hobby-plan Vercel accounts can't schedule
// more often than that), landing at 5am Pacific during PDT and 4am during PST. The hour check
// below is a generous sanity window rather than an exact match: it exists to stop a stray manual
// trigger at the wrong time of day from notifying everyone, while still tolerating that seasonal
// one-hour DST offset. lastNotifiedDate is what actually keeps this to once per profile per day.
//
// Deliberately never calls generateDailyReading/buildReading: this only *reads* the profile's
// current cursor position via peekCurrentCurriculumItem, matching what removing the old nightly
// cron was about (see vercel.ts) — a profile nobody has opened the app for today must not have
// its curriculum position touched just because this ran.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const hour = pacificHour();
  if (hour < 3 || hour > 8) {
    return NextResponse.json({ status: "skipped", reason: "outside the morning window" });
  }

  const today = pacificDateString();
  const due = await db.select().from(profiles).where(eq(profiles.notificationsEnabled, true));

  let sent = 0;
  let skipped = 0;

  for (const profile of due) {
    if (profile.lastNotifiedDate === today) {
      skipped++;
      continue;
    }

    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.profileId, profile.id));

    if (subs.length > 0) {
      const item = await peekCurrentCurriculumItem(profile);
      const lang = profile.uiLang === "ko" ? "ko" : "en";
      const passageLabel = item
        ? lang === "ko"
          ? formatPassageRefKorean(item.passageRef)
          : formatPassageRefEnglish(item.passageRef)
        : null;

      const title = lang === "ko" ? "오늘의 말씀이 준비됐어요" : "Today's reading is ready";
      const body = passageLabel
        ? lang === "ko"
          ? `오늘은 ${passageLabel}이에요.`
          : `Today's passage: ${passageLabel}.`
        : lang === "ko"
          ? "지금 열어서 확인해보세요."
          : "Open the app to see it.";

      const webpush = getWebPush();
      await Promise.all(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify({ title, body }),
            );
          } catch (err) {
            const statusCode = (err as { statusCode?: number })?.statusCode;
            if (statusCode === 404 || statusCode === 410) {
              await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
            }
          }
        }),
      );
      sent++;
    }

    await db.update(profiles).set({ lastNotifiedDate: today }).where(eq(profiles.id, profile.id));
  }

  return NextResponse.json({ status: "ok", sent, skipped });
}
