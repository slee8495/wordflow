"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { pauseSpeaking, resumeSpeaking, speak, stopSpeaking } from "@/lib/speak";

type SpeakState = "loading" | "playing" | "paused" | null;

type PlaybackContextValue = {
  // Identifies which piece of content is currently loaded/playing (e.g. "reading-passage" or
  // "today-context") — a page checks this against its own id to know whether ITS highlight
  // should track activeChunkIndex, since only one thing can play globally at a time.
  sourceId: string | null;
  label: string | null;
  speakState: SpeakState;
  activeChunkIndex: number | null;
  playText: (sourceId: string, label: string, text: string, startIndex?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
};

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [speakState, setSpeakState] = useState<SpeakState>(null);
  const [activeChunkIndex, setActiveChunkIndex] = useState<number | null>(null);
  // Guards a stale playText() call's callbacks/cleanup from running after a newer call (or an
  // explicit stop()) has already taken over — same idea as speak.ts's own playToken, one level up.
  const genRef = useRef(0);

  const playText = useCallback((id: string, lbl: string, text: string, startIndex?: number) => {
    if (!text.trim()) return;
    const gen = ++genRef.current;
    setSourceId(id);
    setLabel(lbl);
    setSpeakState("loading");
    setActiveChunkIndex(startIndex ?? null);

    speak(text, {
      onPlaybackStart: () => {
        if (genRef.current !== gen) return;
        setSpeakState((cur) => (cur ? "playing" : cur));
      },
      onChunkStart: (index) => {
        if (genRef.current !== gen) return;
        setActiveChunkIndex(index);
      },
      startIndex,
    }).then(() => {
      if (genRef.current !== gen) return; // superseded by a newer playText() or an explicit stop()
      setSpeakState(null);
      setActiveChunkIndex(null);
      setSourceId(null);
      setLabel(null);
    });
  }, []);

  const pause = useCallback(() => {
    setSpeakState((cur) => {
      if (cur !== "playing") return cur;
      pauseSpeaking();
      return "paused";
    });
  }, []);

  const resume = useCallback(() => {
    setSpeakState((cur) => {
      if (cur !== "paused") return cur;
      resumeSpeaking();
      return "playing";
    });
  }, []);

  const stop = useCallback(() => {
    genRef.current++;
    stopSpeaking();
    setSpeakState(null);
    setActiveChunkIndex(null);
    setSourceId(null);
    setLabel(null);
  }, []);

  // Media Session integration serves two purposes: lock-screen/notification playback controls,
  // and — more importantly — signaling to the browser that this tab holds a real, ongoing media
  // session. Without it, mobile browsers treat a backgrounded tab's audio as non-essential and
  // block the next chunk's audio.play() call once the current clip ends, which is why playback
  // used to stop right at the sentence you were on when you switched apps instead of continuing.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!label) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({ title: label, artist: "Wordflow" });
    navigator.mediaSession.playbackState = speakState === "paused" ? "paused" : "playing";
  }, [label, speakState]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", resume);
    navigator.mediaSession.setActionHandler("pause", pause);
    navigator.mediaSession.setActionHandler("stop", stop);
    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("stop", null);
    };
  }, [pause, resume, stop]);

  return (
    <PlaybackContext.Provider value={{ sourceId, label, speakState, activeChunkIndex, playText, pause, resume, stop }}>
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error("usePlayback must be used within PlaybackProvider");
  return ctx;
}
