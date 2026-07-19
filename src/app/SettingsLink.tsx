"use client";

import Link from "next/link";
import { useUiLanguage } from "./UiLanguageProvider";

export function SettingsLink() {
  const { t } = useUiLanguage();
  const label = t("nav.settingsLabel");
  return (
    <Link
      href="/settings"
      aria-label={label}
      title={label}
      className="rounded-full p-2 text-lg text-[var(--ink-soft)] transition-colors hover:bg-[var(--clay-tint)] hover:text-[var(--ink)]"
    >
      ⚙️
    </Link>
  );
}
