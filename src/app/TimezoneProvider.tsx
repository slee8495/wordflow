"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_TIMEZONE } from "@/lib/date";

export const TIMEZONE_STORAGE_KEY = "wordflow:timezone";

const TimezoneContext = createContext<{
  timezone: string;
  setTimezone: (timezone: string) => void;
} | null>(null);

function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

// Mirrors UiLanguageProvider's shape: initial state matches what the server would render
// (DEFAULT_TIMEZONE, to avoid a hydration mismatch), then a mount effect resolves the real
// value — an explicit prior choice from localStorage if one exists, otherwise the browser's own
// timezone auto-detected via Intl, which becomes that profile's initial preference from then on.
export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const [timezone, setTimezoneState] = useState<string>(DEFAULT_TIMEZONE);

  useEffect(() => {
    const stored = localStorage.getItem(TIMEZONE_STORAGE_KEY);
    if (stored) {
      setTimezoneState(stored);
    } else {
      const detected = detectBrowserTimezone();
      setTimezoneState(detected);
      localStorage.setItem(TIMEZONE_STORAGE_KEY, detected);
    }
  }, []);

  function setTimezone(next: string) {
    setTimezoneState(next);
    localStorage.setItem(TIMEZONE_STORAGE_KEY, next);
  }

  return <TimezoneContext.Provider value={{ timezone, setTimezone }}>{children}</TimezoneContext.Provider>;
}

export function useTimezone() {
  const ctx = useContext(TimezoneContext);
  if (!ctx) throw new Error("useTimezone must be used within TimezoneProvider");
  return ctx;
}
