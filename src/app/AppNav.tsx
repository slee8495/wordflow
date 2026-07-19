"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUiLanguage } from "./UiLanguageProvider";

const TABS = [
  { href: "/", key: "nav.today" },
  { href: "/reading", key: "nav.reading" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const { t } = useUiLanguage();

  return (
    <nav className="flex gap-1">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-[var(--clay-deep)] text-[var(--paper-raised)]"
                : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
