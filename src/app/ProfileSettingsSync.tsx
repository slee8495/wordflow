"use client";

import { useEffect } from "react";
import { useTimezone } from "./TimezoneProvider";
import { useUiLanguage } from "./UiLanguageProvider";
import { useUser } from "./UserProvider";

// Mirrors the client's UI-language and timezone settings onto the profile row so server-side
// code that has no request/session context — the morning-reminder cron — can still compose text
// in the right language and know the profile's own day boundary / notification hour reference.
// Rendered once near the root, inside UserProvider/UiLanguageProvider/TimezoneProvider.
export function ProfileSettingsSync() {
  const { name } = useUser();
  const { uiLang } = useUiLanguage();
  const { timezone } = useTimezone();

  useEffect(() => {
    if (!name) return;
    fetch("/api/profile/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, uiLang, timezone }),
    }).catch(() => {});
  }, [name, uiLang, timezone]);

  return null;
}
