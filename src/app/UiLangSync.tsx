"use client";

import { useEffect } from "react";
import { useUiLanguage } from "./UiLanguageProvider";
import { useUser } from "./UserProvider";

// Mirrors the client's UI-language setting onto the profile row so server-side code that has no
// request/session context — the morning-reminder cron — can still compose text in the right
// language. Rendered once near the root, inside both UserProvider and UiLanguageProvider.
export function UiLangSync() {
  const { name } = useUser();
  const { uiLang } = useUiLanguage();

  useEffect(() => {
    if (!name) return;
    fetch("/api/profile/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, uiLang }),
    }).catch(() => {});
  }, [name, uiLang]);

  return null;
}
