"use client";

import { useState } from "react";
import { FONT_SCALES } from "@/lib/fontScale";
import { useFontScale } from "../FontScaleProvider";
import { useUser } from "../UserProvider";

export default function SettingsPage() {
  const { scale, setScale } = useFontScale();
  const { name, login, logout } = useUser();
  const [nameInput, setNameInput] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--ink)]">Settings</h1>

      <section className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-4">
        <h2 className="text-sm font-semibold text-[var(--ink-soft)]">Account</h2>
        {name ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--ink)]">Logged in as <span className="font-medium">{name}</span></p>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] hover:border-[var(--clay)] hover:text-[var(--ink)]"
            >
              Log out
            </button>
          </div>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nameInput.trim()) return;
              login(nameInput);
              setNameInput("");
            }}
          >
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Name"
              className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--clay)]"
            />
            <button
              type="submit"
              className="rounded-lg bg-[var(--clay-deep)] px-3 py-1.5 text-sm font-medium text-[var(--paper-raised)]"
            >
              Log in
            </button>
          </form>
        )}
        <p className="text-sm text-[var(--ink-soft)]">
          Your name is your login for now — it&apos;s how your reading progress is saved.
        </p>
      </section>

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
