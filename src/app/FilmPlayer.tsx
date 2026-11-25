"use client";

import { useEffect, useRef, useState } from "react";

export type FilmCue = { start: number; end: number; text: string };
export type Film = { videoUrl: string; posterUrl: string | null; cues: FilmCue[] | null; durationSec: number | null };

// The subtitle to show at playback time t. Held a beat past each cue's end so it doesn't blink out
// during the short pause between narrated sentences.
export function cueAt(cues: FilmCue[] | null | undefined, t: number): string | null {
  return cues?.find((c) => t >= c.start && t < c.end + 0.25)?.text ?? null;
}

// "영상으로 보기": the nightly-made film (photoreal scenes + the app's reading voice) with the
// Korean narration shown as a subtitle under the picture rather than burned into it, so it stays
// readable at any font size and doesn't cover the scene.
export function FilmPlayer({
  film,
  vttUrl,
  onPlay,
  pause,
}: {
  film: Film;
  vttUrl: string; // same-origin WebVTT of film.cues, for the full-screen player
  onPlay: () => void; // stop the TTS reader so two voices never overlap
  pause: boolean; // true while the TTS reader is playing something else
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cue, setCue] = useState<string | null>(null);

  useEffect(() => {
    if (pause) videoRef.current?.pause();
  }, [pause]);

  // Inline, subtitles are drawn below the picture (the <p> further down), so the <track> stays
  // hidden. Full screen shows only the video element itself — on iPhone it's the native player —
  // so the track is switched on for as long as full screen lasts.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const setShowing = (showing: boolean) => {
      for (const track of Array.from(video.textTracks)) track.mode = showing ? "showing" : "hidden";
    };
    const onDocFullscreen = () => {
      const el = document.fullscreenElement ?? (document as { webkitFullscreenElement?: Element }).webkitFullscreenElement;
      setShowing(!!el && (el === video || el.contains(video)));
    };
    const onBegin = () => setShowing(true);
    const onEnd = () => setShowing(false);
    const onTrackAdded = () => setShowing(false);
    setShowing(false);
    video.textTracks.addEventListener?.("addtrack", onTrackAdded);
    video.addEventListener("webkitbeginfullscreen", onBegin);
    video.addEventListener("webkitendfullscreen", onEnd);
    document.addEventListener("fullscreenchange", onDocFullscreen);
    document.addEventListener("webkitfullscreenchange", onDocFullscreen);
    return () => {
      video.textTracks.removeEventListener?.("addtrack", onTrackAdded);
      video.removeEventListener("webkitbeginfullscreen", onBegin);
      video.removeEventListener("webkitendfullscreen", onEnd);
      document.removeEventListener("fullscreenchange", onDocFullscreen);
      document.removeEventListener("webkitfullscreenchange", onDocFullscreen);
    };
  }, [vttUrl]);

  function onTime() {
    setCue(cueAt(film.cues, videoRef.current?.currentTime ?? 0));
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-black shadow-sm">
      <video
        ref={videoRef}
        src={film.videoUrl}
        poster={film.posterUrl ?? undefined}
        controls
        playsInline
        preload="metadata"
        onPlay={onPlay}
        onTimeUpdate={onTime}
        onSeeked={onTime}
        className="aspect-[7/4] w-full bg-black"
      >
        <track kind="subtitles" src={vttUrl} srcLang="ko" label="한국어" default />
      </video>
      <div className="flex min-h-[5.5rem] items-center justify-center px-4 py-3 text-center">
        <p className="text-base leading-relaxed text-[#ece4d2]">{cue ?? " "}</p>
      </div>
    </section>
  );
}
