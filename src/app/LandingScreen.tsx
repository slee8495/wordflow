"use client";

import { useUiLanguage } from "./UiLanguageProvider";
import { useUser } from "./UserProvider";

// Shown at "/" in place of AuthScreen specifically when signed out (not while loading or mid
// onboarding — those still get AuthScreen's compact treatment) — the one place a first-time
// visitor should see what Wordflow actually is before being asked to sign in.
export function LandingScreen() {
  const { signInWithGoogle } = useUser();
  const { t } = useUiLanguage();

  const features: Array<["landing.feature.cycle" | "landing.feature.context" | "landing.feature.audio", string]> = [
    ["landing.feature.cycle", "📖"],
    ["landing.feature.context", "🕊️"],
    ["landing.feature.audio", "🔊"],
  ];

  return (
    <div className="flex flex-col gap-10 py-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="text-4xl">📖</span>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">{t("landing.tagline")}</h1>
        <p className="max-w-md text-sm text-[var(--ink-soft)]">{t("landing.subtitle")}</p>
        <button
          onClick={signInWithGoogle}
          className="mt-2 rounded-lg bg-[var(--clay-deep)] px-5 py-2.5 text-sm font-medium text-[var(--paper-raised)]"
        >
          {t("landing.cta")}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {features.map(([key, icon]) => (
          <div
            key={key}
            className="flex flex-col gap-2 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-4"
          >
            <span className="text-xl">{icon}</span>
            <h2 className="text-sm font-semibold text-[var(--ink)]">{t(`${key}.title` as Parameters<typeof t>[0])}</h2>
            <p className="text-sm text-[var(--ink-soft)]">{t(`${key}.body` as Parameters<typeof t>[0])}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-[var(--line)] p-4 text-center">
        <p className="text-sm font-semibold text-[var(--ink)]">{t("landing.pricing.title")}</p>
        <p className="max-w-md text-sm text-[var(--ink-soft)]">{t("landing.pricing.body")}</p>
      </div>

      <div className="flex justify-center gap-4 text-xs text-[var(--ink-soft)]">
        <a href="/privacy" className="hover:underline">
          Privacy Policy
        </a>
        <a href="/terms" className="hover:underline">
          Terms of Service
        </a>
      </div>
    </div>
  );
}
