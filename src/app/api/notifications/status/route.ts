import { NextResponse } from "next/server";
import { DEFAULT_NOTIFICATION_HOUR } from "@/lib/date";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";

export async function GET() {
  try {
    const profile = await requireProfile();
    return NextResponse.json({
      enabled: profile.notificationsEnabled,
      timezone: profile.timezone,
      notificationHour: profile.notificationHour ?? DEFAULT_NOTIFICATION_HOUR,
    });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    throw err;
  }
}
