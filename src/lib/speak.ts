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
  // Used to require [.!?]+ to be followed by whitespace-or-end to count as a sentence boundary,
  // to avoid treating something like "3.14" as two sentences. But dialogue-heavy prose (story
  // mode is full of it) routinely has the closing punctuation land *inside* a quote with nothing
  // but more text right after — English: `said, "My son." "Yes?" Esau replied.` (quote then a
  // space, still fine) but Korean quotative grammar attaches the next word directly with NO space
  // at all: `...하셨나요?"라고 물었습니다` (question mark, closing quote, then straight into the
  // next word). Requiring a trailing whitespace/end at that position can never match, and
  // `String.match` with /g just silently skips forward to wherever it next CAN match — dropping
  // every sentence in between entirely (confirmed: this is what made the opening of Genesis 27's
  // story mode disappear, and separately, whole clauses inside other readings' Korean story text
  // whenever a quote ended with a directly-attached particle). Dropping the requirement instead of
  // trying to enumerate every language's attachment rule guarantees every character of the input
  // ends up in some chunk — verified by reconstructing the original string from the chunks.
  const sentences = text.match(/[^.!?]+[.!?]+["'‘’“”]*|[^.!?]+$/g) ?? [text];
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

// By-verse passage text carries "(1) ", "(2) " ... markers so readers can see verse boundaries —
// but a TTS engine reads them back literally as numbers ("one", "two"...), which is exactly the
// bug this strips: the marker is display-only, spoken text should never include it. Global (not
// just a leading match) since MAX_CHUNK_LENGTH bucketing can group more than one short verse into
// a single chunk, putting a second "(N) " mid-string.
function stripVerseMarkers(text: string): string {
  return text.replace(/\(\d+\)\s*/g, "");
}

// Without an explicit lang, Android Chrome's speechSynthesis picks a voice by the device's
// system-default TTS language rather than the text's actual language — so Korean content could
// get read in an English voice (or vice versa) purely based on the phone's locale setting. iOS
// Safari happens to be more forgiving here (it tends to sniff the text), which is why this only
// ever showed up as an Android complaint. Setting utterance.lang pins it to what the app actually
// selected instead of leaving it to the OS's default.
function speakWithBrowserVoice(text: string, lang: "ko" | "en" | undefined, onStart?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  if (lang) utterance.lang = lang === "ko" ? "ko-KR" : "en-US";
  if (onStart) utterance.onstart = onStart;
  window.speechSynthesis.speak(utterance);
}

// Tells the OS-level media session (lock screen / notification player) the clip's real duration
// and current position, so it can show a live remaining-time/scrubber instead of nothing — without
// this, iOS in particular shows play/pause controls with no sense of progress. Wrapped defensively
// since setPositionState throws if duration isn't a finite positive number yet (e.g. right as a
// new clip's metadata is still loading).
function updatePositionState(audio: HTMLAudioElement) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      playbackRate: audio.playbackRate || 1,
      position: Math.min(audio.currentTime, audio.duration),
    });
  } catch {
    // Some browsers throw if called at the "wrong" moment (e.g. mid-source-change) — position
    // state is a nice-to-have, never worth surfacing an error over.
  }
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
  if (currentAudio) updatePositionState(currentAudio);
  if (typeof window !== "undefined" && window.speechSynthesis?.speaking) {
    window.speechSynthesis.pause();
  }
}

// Resolves true only if audio actually resumed — a lock-screen "play" tap after the phone has
// been backgrounded/locked for a while can reach this code with `currentAudio` pointing at an
// element whose underlying buffered data iOS has quietly discarded (or the audio has been
// interrupted, e.g. by a phone call), in which case .play() rejects or resolves without ever
// actually starting. Silently swallowing that (as this used to do) left the UI/media-session
// stuck showing "playing" forever with no sound — the caller uses the return value to reset back
// to a clean not-playing state instead, so at least it's honestly showing nothing is happening.
export async function resumeSpeaking(): Promise<boolean> {
  if (typeof window !== "undefined" && window.speechSynthesis?.paused) {
    window.speechSynthesis.resume();
    return true;
  }
  if (!currentAudio) return false;
  try {
    await currentAudio.play();
    if (!currentAudio.paused) updatePositionState(currentAudio);
    return !currentAudio.paused;
  } catch {
    return false;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A full passage fires every chunk's fetch at once (see speak() below) — a burst that's exactly
// when a transient failure (cold start, a brief rate limit from the TTS backend, a flaky mobile
// connection) is most likely to hit. Previously a single failed chunk was dropped for good, and
// when that happened to a run of consecutive chunks near the end of a passage, playback would
// finish early — sounding like the audio "cut off" partway through. Retrying a couple of times
// before giving up on a chunk makes that far less likely.
async function fetchWithRetry(text: string, attempts = 3): Promise<ArrayBuffer> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(400 * i);
    try {
      const res = await fetch(`/api/speak?text=${encodeURIComponent(text)}`);
      if (!res.ok) throw new Error("tts request failed");
      return await res.arrayBuffer();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

function fetchAudioBuffer(text: string): Promise<ArrayBuffer | null> {
  const cached = audioBufferCache.get(text);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(text);
  if (pending) return pending;

  const promise = fetchWithRetry(text)
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
  opts: {
    onPlaybackStart?: () => void;
    onChunkStart?: (index: number) => void;
    startIndex?: number;
    lang?: "ko" | "en";
  } = {},
) {
  if (!text.trim()) return;
  stopSpeaking(); // also bumps playToken, so capture `token` only after this
  const token = playToken;

  const chunks = splitIntoChunks(text);
  const startIndex = Math.min(Math.max(opts.startIndex ?? 0, 0), Math.max(chunks.length - 1, 0));
  const requested = chunks.slice(startIndex);

  // Chunk boundaries/indices below (offsets, activeChunkIndex, highlighting) all stay keyed off
  // the ORIGINAL `chunks`/`requested` text, so stripping markers only for the TTS request doesn't
  // shift anything the UI depends on for click-to-seek or highlight sync.
  const buffers = await Promise.all(requested.map((chunk) => fetchAudioBuffer(stripVerseMarkers(chunk))));
  if (token !== playToken) return;

  // Chunks that failed to generate are quietly skipped from the combined file rather than
  // derailing the whole passage into the browser voice over one flaky request — only a total
  // outage (every chunk failed) falls back to reading everything requested via speechSynthesis.
  const ok: { buffer: ArrayBuffer; index: number }[] = [];
  buffers.forEach((buffer, i) => {
    if (buffer) ok.push({ buffer, index: startIndex + i });
  });

  if (ok.length === 0) {
    speakWithBrowserVoice(requested.join(" "), opts.lang, () => {
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

    const reportPosition = () => {
      const t = audio.currentTime;
      let current = offsets[0].index;
      for (const o of offsets) {
        if (t >= o.start) current = o.index;
        else break;
      }
      opts.onChunkStart?.(current);
      updatePositionState(audio);
    };

    // 'timeupdate' is the "correct" event for this, but browsers make no guarantee about how
    // often it actually fires — it's been observed to stall for long stretches even while a tab
    // stays in the foreground with audio audibly still playing, which showed up as the sentence
    // highlight freezing mid-passage. Polling audio.currentTime every animation frame instead
    // sidesteps that unreliability entirely; it's cheap (a couple of comparisons, 60x/sec) and
    // only runs while something is actually loaded and playing.
    let rafId: number | null = null;
    const trackLoop = () => {
      reportPosition();
      rafId = requestAnimationFrame(trackLoop);
    };
    const stopTracking = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    };

    let announced = false;
    const onPlaying = () => {
      if (announced) return;
      announced = true;
      opts.onPlaybackStart?.();
      opts.onChunkStart?.(offsets[0].index);
      updatePositionState(audio);
      stopTracking();
      rafId = requestAnimationFrame(trackLoop);
    };
    const onEnded = () => finish();
    const onError = () => finish();
    function finish() {
      stopTracking();
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      activeCleanup = null;
      currentStopResolve = null;
      resolve();
    }
    activeCleanup = finish;

    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });

    audio.src = url;
    audio.play().catch(() => finish());
  });
}
