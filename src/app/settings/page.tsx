"use client";

import { FONT_SCALES } from "@/lib/fontScale";
import { useFontScale } from "../FontScaleProvider";

export default function SettingsPage() {
  const { scale, setScale } = useFontScale();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--ink)]">Settings</h1>

      <section className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-4">
        <h2 className="text-sm font-semibold text-[var(--ink-soft)]">Font Size</h2>
        <div className="grid grid-cols-3 gap-2">
          {FONT_SCALES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setScale(option.value)}
              aria-pressed={scale === option.value}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-colors ${
                scale === option.value
                  ? "border-[var(--clay-deep)] bg-[var(--clay-tint)] text-[var(--clay-deep)]"
                  : "border-[var(--line)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              <span style={{ fontSize: `${option.value}rem` }}>Aa</span>
              <span className="text-xs">{option.label}</span>
            </button>
          ))}
        </div>
        <p className="text-sm text-[var(--ink-soft)]">Applies across the whole app instantly.</p>
      </section>
    </div>
  );
}
