// Client-side helper for reading reply/reading text aloud. Prefers the neural /api/speak voice
// (AI Gateway TTS) and falls back to the browser's built-in Web Speech API if that request
// fails entirely (offline, cold start, etc).
//
// Every requested chunk's audio is fetched, measured, and concatenated into ONE continuous file
// before playback starts, rather than chained via a separate play() call per sentence. Mobile
// browsers only reliably honor background/screen-lock playback for a single ongoing session
// started by a user gesture — calling play() again for a new source mid-session (even reusing
// the same <audio> element) can silently fail once the app is actually backgrounded, which
// showed up as playback either stopping dead or racing through the remaining sentences almost
// instantly. A single native playback from one gesture-started element sidesteps that.
//
// The tradeoff: since concatenation needs every chunk's bytes up front, playback can't start
// until all of them are ready — slower to first sound than playing chunk 0 the moment it lands,
// but chunks are still fetched in parallel, so the wait is bounded by the slowest one, not the
// sum of all of them.
//
// Overlapping playback ("multiple voices at once"): if a new speak() call comes in while a
// previous one is still preparing, the old call would eventually finish and start playing right
// on top of the new one. A monotonic token invalidates any in-flight call as soon as a newer one
// starts, so stale audio never gets played.
const audioBufferCache = new Map<string, ArrayBuffer>();
const inFlight = new Map<string, Promise<ArrayBuffer | null>>();
// Reused across sessions instead of a fresh `new Audio()` every time — see the file header for
// why a single gesture-started element matters for background playback.
let currentAudio: HTMLAudioElement | null = null;
// Resolves the playback promise currently in flight, if any — stopSpeaking() uses this to
// unblock a hung await immediately instead of waiting on an event that may never fire.
let currentStopResolve: (() => void) | null = null;
// Detaches the current session's event listeners — stopSpeaking() calls this directly so a
// superseded session's 'ended'/'timeupdate' handlers (closing over its own stale offsets/opts)
// can't keep firing into the next session once it reuses the same <audio> element.
let activeCleanup: (() => void) | null = null;
let activeObjectUrl: string | null = null;
let playToken = 0;

const MAX_CHUNK_LENGTH = 200;

export function splitIntoChunks(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) ?? [text];
  const chunks: string[] = [];
  let buf = "";
  for (const sentence of sentences) {
    if (buf && buf.length + sentence.length > MAX_CHUNK_LENGTH) {
      chunks.push(buf.trim());
      buf = sentence;
    } else {
      buf += sentence;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

function speakWithBrowserVoice(text: string, onStart?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  if (onStart) utterance.onstart = onStart;
  window.speechSynthesis.speak(utterance);
}

// A hard stop: abandons whatever's currently playing/preparing and unblocks speak()'s awaited
// promise so a caller's `await speak(...)` reliably returns instead of hanging forever.
export function stopSpeaking() {
  playToken++;
  activeCleanup?.();
  activeCleanup = null;
  currentAudio?.pause();
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  currentStopResolve?.();
  currentStopResolve = null;
}

// A soft pause: unlike stopSpeaking(), deliberately does NOT resolve the in-flight playback
// promise or touch playToken — the sequence should stay suspended where it is and pick back up
// via resumeSpeaking(), not jump ahead or fall back to the browser voice.
export function pauseSpeaking() {
  currentAudio?.pause();
  if (typeof window !== "undefined" && window.speechSynthesis?.speaking) {
    window.speechSynthesis.pause();
  }
}

export function resumeSpeaking() {
  currentAudio?.play().catch(() => {});
  if (typeof window !== "undefined" && window.speechSynthesis?.paused) {
    window.speechSynthesis.resume();
  }
}

function fetchAudioBuffer(text: string): Promise<ArrayBuffer | null> {
  const cached = audioBufferCache.get(text);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(text);
  if (pending) return pending;

  const promise = fetch(`/api/speak?text=${encodeURIComponent(text)}`)
    .then((res) => {
      if (!res.ok) throw new Error("tts request failed");
      return res.arrayBuffer();
    })
    .then((buffer) => {
      audioBufferCache.set(text, buffer);
      return buffer;
    })
    .catch(() => null)
    .finally(() => inFlight.delete(text));

  inFlight.set(text, promise);
  return promise;
}

// Measures a chunk's playback duration via a throwaway <audio> element — used to build the
// cumulative time offsets that drive activeChunkIndex off real playback position (see speak()).
function measureDuration(buffer: ArrayBuffer): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([buffer], { type: "audio/mpeg" }));
    const probe = new Audio();
    const cleanup = () => {
      probe.removeEventListener("loadedmetadata", onLoaded);
      probe.removeEventListener("error", onErr);
      URL.revokeObjectURL(url);
    };
    const onLoaded = () => {
      const duration = Number.isFinite(probe.duration) ? probe.duration : 0;
      cleanup();
      resolve(duration);
    };
    const onErr = () => {
      cleanup();
      resolve(0);
    };
    probe.addEventListener("loadedmetadata", onLoaded, { once: true });
    probe.addEventListener("error", onErr, { once: true });
    probe.src = url;
  });
}

export async function speak(
  text: string,
  opts: { onPlaybackStart?: () => void; onChunkStart?: (index: number) => void; startIndex?: number } = {},
) {
  if (!text.trim()) return;
  stopSpeaking(); // also bumps playToken, so capture `token` only after this
  const token = playToken;

  const chunks = splitIntoChunks(text);
  const startIndex = Math.min(Math.max(opts.startIndex ?? 0, 0), Math.max(chunks.length - 1, 0));
  const requested = chunks.slice(startIndex);

  const buffers = await Promise.all(requested.map((chunk) => fetchAudioBuffer(chunk)));
  if (token !== playToken) return;

  // Chunks that failed to generate are quietly skipped from the combined file rather than
  // derailing the whole passage into the browser voice over one flaky request — only a total
  // outage (every chunk failed) falls back to reading everything requested via speechSynthesis.
  const ok: { buffer: ArrayBuffer; index: number }[] = [];
  buffers.forEach((buffer, i) => {
    if (buffer) ok.push({ buffer, index: startIndex + i });
  });

  if (ok.length === 0) {
    speakWithBrowserVoice(requested.join(" "), () => {
      opts.onChunkStart?.(startIndex);
      opts.onPlaybackStart?.();
    });
    return;
  }

  const durations = await Promise.all(ok.map((c) => measureDuration(c.buffer)));
  if (token !== playToken) return;

  const url = URL.createObjectURL(new Blob(ok.map((c) => c.buffer), { type: "audio/mpeg" }));
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  activeObjectUrl = url;

  // Cumulative start time (seconds) for each included chunk, paired with its real index into
  // `chunks` (not its position in `ok`, since failed chunks were dropped).
  let cursor = 0;
  const offsets = ok.map((c, i) => {
    const start = cursor;
    cursor += durations[i];
    return { start, index: c.index };
  });

  const audio = currentAudio ?? new Audio();
  currentAudio = audio;

  await new Promise<void>((resolve) => {
    currentStopResolve = resolve;

    let announced = false;
    const onPlaying = () => {
      if (announced) return;
      announced = true;
      opts.onPlaybackStart?.();
      opts.onChunkStart?.(offsets[0].index);
    };
    const onTimeUpdate = () => {
      const t = audio.currentTime;
      let current = offsets[0].index;
      for (const o of offsets) {
        if (t >= o.start) current = o.index;
        else break;
      }
      opts.onChunkStart?.(current);
    };
    const onEnded = () => finish();
    const onError = () => finish();
    function finish() {
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      activeCleanup = null;
      currentStopResolve = null;
      resolve();
    }
    activeCleanup = finish;

    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });

    audio.src = url;
    audio.play().catch(() => finish());
  });
}
