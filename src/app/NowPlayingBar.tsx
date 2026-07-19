"use client";

import { usePlayback } from "./PlaybackProvider";
import { useUiLanguage } from "./UiLanguageProvider";

// Persistent bottom playback bar, visible app-wide whenever anything is loaded/playing — like a
// music app's mini player. Lets playback continue (and stay controllable) across navigation
// between Today/Reading instead of only from the section it was started in.
export function NowPlayingBar() {
  const { label, speakState, pause, resume, stop } = usePlayback();
  const { t } = useUiLanguage();

  if (!label) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[var(--paper-raised)]/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        <span className="text-lg">🔊</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ink)]">{label}</span>
        <button
          onClick={() => (speakState === "paused" ? resume() : pause())}
          disabled={speakState === "loading"}
          className="text-xl disabled:opacity-50"
          aria-label={speakState === "paused" ? t("reading.resume") : t("reading.pause")}
        >
          {speakState === "loading" ? "…" : speakState === "paused" ? "▶️" : "⏸️"}
        </button>
        <button onClick={stop} className="text-xl" aria-label={t("reading.stop")}>
          ⏹️
        </button>
      </div>
    </div>
  );
}
