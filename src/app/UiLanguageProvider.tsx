"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_UI_LANG, UI_LANG_STORAGE_KEY, translate, type Lang, type UiStringKey } from "@/lib/i18n";

const UiLanguageContext = createContext<{
  uiLang: Lang;
  setUiLang: (lang: Lang) => void;
  t: (key: UiStringKey) => string;
} | null>(null);

export function UiLanguageProvider({ children }: { children: React.ReactNode }) {
  const [uiLang, setUiLangState] = useState<Lang>(DEFAULT_UI_LANG);

  useEffect(() => {
    const stored = localStorage.getItem(UI_LANG_STORAGE_KEY);
    if (stored === "ko" || stored === "en") {
      setUiLangState(stored);
    }
  }, []);

  function setUiLang(next: Lang) {
    setUiLangState(next);
    localStorage.setItem(UI_LANG_STORAGE_KEY, next);
  }

  const t = useCallback((key: UiStringKey) => translate(uiLang, key), [uiLang]);

  return <UiLanguageContext.Provider value={{ uiLang, setUiLang, t }}>{children}</UiLanguageContext.Provider>;
}

export function useUiLanguage() {
  const ctx = useContext(UiLanguageContext);
  if (!ctx) throw new Error("useUiLanguage must be used within UiLanguageProvider");
  return ctx;
}
