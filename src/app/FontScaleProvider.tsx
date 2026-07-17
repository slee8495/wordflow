"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_FONT_SCALE, FONT_SCALE_STORAGE_KEY, isValidFontScale } from "@/lib/fontScale";

const FontScaleContext = createContext<{
  scale: number;
  setScale: (scale: number) => void;
} | null>(null);

function applyScale(scale: number) {
  document.documentElement.style.setProperty("--font-scale", String(scale));
}

export function FontScaleProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScaleState] = useState(DEFAULT_FONT_SCALE);

  useEffect(() => {
    const stored = Number(localStorage.getItem(FONT_SCALE_STORAGE_KEY));
    if (isValidFontScale(stored)) {
      setScaleState(stored);
      applyScale(stored);
    }
  }, []);

  function setScale(next: number) {
    setScaleState(next);
    applyScale(next);
    localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(next));
  }

  return <FontScaleContext.Provider value={{ scale, setScale }}>{children}</FontScaleContext.Provider>;
}

export function useFontScale() {
  const ctx = useContext(FontScaleContext);
  if (!ctx) throw new Error("useFontScale must be used within FontScaleProvider");
  return ctx;
}
