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
  onPlay,
  pause,
}: {
  film: Film;
  onPlay: () => void; // stop the TTS reader so two voices never overlap
  pause: boolean; // true while the TTS reader is playing something else
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cue, setCue] = useState<string | null>(null);

  useEffect(() => {
    if (pause) videoRef.current?.pause();
  }, [pause]);

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
      />
      <div className="flex min-h-[5.5rem] items-center justify-center px-4 py-3 text-center">
        <p className="text-base leading-relaxed text-[#ece4d2]">{cue ?? " "}</p>
      </div>
    </section>
  );
}
