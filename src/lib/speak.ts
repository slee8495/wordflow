// Client-side helper for reading reply/reading text aloud. Prefers the neural /api/speak voice
// (AI Gateway TTS) and falls back to the browser's built-in Web Speech API if that request
// fails (offline, cold start, etc).
//
// Two things this file exists to solve:
// 1. TTS generation time scales with text length, so a long passage took several seconds
//    before any sound played. Text is split into sentence-sized chunks that are all fetched
//    in parallel but played back in order — the first chunk is usually ready in ~1-2s, and
//    later chunks keep generating in the background while earlier ones are still playing.
// 2. Overlapping playback ("multiple voices at once"): if a new speak() call comes in while
//    a previous one is still waiting on generation, the old call would eventually finish and
//    start playing right on top of the new one. A monotonic token invalidates any in-flight
//    call as soon as a newer one starts, so stale audio never gets played.
const audioUrlCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();
// Reused across every chunk in (and across) a playback session instead of a fresh `new Audio()`
// per chunk. Mobile browsers grant "keep playing while backgrounded/locked" permission to the
// specific element a user gesture started — swapping this element's `src` stays inside that
// grant, whereas creating a new element for each sentence generally does not, which is why
// playback used to stop dead at the sentence you were on the moment you backgrounded the app.
let currentAudio: HTMLAudioElement | null = null;
// Resolver for the playAudio() promise currently in flight, if any — stopSpeaking() uses this to
// unblock a hung await immediately (see the comment on playAudio for why that's necessary).
let currentStopResolve: ((finished: boolean) => void) | null = null;
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

// A hard stop: abandons whatever's currently playing/loading and unblocks speak()'s awaited
// playAudio() promise (see playAudio) so a caller's `await speak(...)` reliably returns instead
// of hanging forever on a clip that's paused-but-never-ending. Bumping playToken makes the
// unblocked loop iteration take the `token !== playToken` exit instead of falling through to the
// "did it finish cleanly" fallback check.
export function stopSpeaking() {
  playToken++;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  currentStopResolve?.(false);
  currentStopResolve = null;
}

// A soft pause: unlike stopSpeaking(), deliberately does NOT resolve the in-flight playAudio()
// promise or touch playToken — the sequence should stay suspended on the current clip and pick
// back up via resumeSpeaking(), not jump to the next chunk or fall back to the browser voice.
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

function fetchAudioUrl(text: string): Promise<string | null> {
  const cached = audioUrlCache.get(text);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(text);
  if (pending) return pending;

  const promise = fetch(`/api/speak?text=${encodeURIComponent(text)}`)
    .then((res) => {
      if (!res.ok) throw new Error("tts request failed");
      return res.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      audioUrlCache.set(text, url);
      return url;
    })
    .catch(() => null)
    .finally(() => inFlight.delete(text));

  inFlight.set(text, promise);
  return promise;
}

// Plays one clip and resolves once it *actually* finishes (or errors). Deliberately does NOT
// treat a bare "pause" event as completion — a pause can fire for reasons that have nothing to
// do with the clip being done (OS media-session interruptions, tab backgrounding, screen lock,
// or a user-initiated pauseSpeaking()), and treating those as "finished" was making playback
// silently skip ahead or stop partway through a reply. Instead the promise just sits until
// either the clip actually ends/errors, or stopSpeaking() forces it via currentStopResolve.
function playAudio(url: string, onStart?: () => void): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = currentAudio ?? new Audio();
    currentAudio = audio;
    currentStopResolve = resolve;

    const onPlaying = () => onStart?.();
    const onEnded = () => settle(true);
    const onError = () => settle(false);
    function settle(finished: boolean) {
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      currentStopResolve = null;
      resolve(finished);
    }

    audio.addEventListener("playing", onPlaying, { once: true });
    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });
    audio.src = url;
    audio.play().catch(() => settle(false));
  });
}

// Fire-and-forget: warms the cache without playing anything.
export function prefetchSpeech(text: string) {
  if (!text.trim()) return;
  for (const chunk of splitIntoChunks(text)) {
    void fetchAudioUrl(chunk);
  }
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
  // Kick off every chunk's fetch immediately (from startIndex on — clicking ahead into a passage
  // shouldn't generate audio for sentences the listener is skipping past) so later ones generate
  // while earlier ones play.
  const urlPromises = chunks.map((chunk, i) => (i >= startIndex ? fetchAudioUrl(chunk) : null));
  // Only the very first chunk's playback start should notify the caller — later chunks continue
  // the same "playing" session seamlessly.
  let announced = false;
  const announceStart = () => {
    if (announced) return;
    announced = true;
    opts.onPlaybackStart?.();
  };

  for (let i = startIndex; i < urlPromises.length; i++) {
    if (token !== playToken) return; // a newer speak() call, or an explicit stop, superseded this one
    const url = await urlPromises[i];
    if (token !== playToken) return;

    if (!url) {
      opts.onChunkStart?.(i);
      speakWithBrowserVoice(chunks.slice(i).join(" "), announceStart);
      return;
    }
    const finishedCleanly = await playAudio(url, () => {
      announceStart();
      opts.onChunkStart?.(i);
    });
    if (token !== playToken) return;
    if (!finishedCleanly) {
      opts.onChunkStart?.(i + 1);
      speakWithBrowserVoice(chunks.slice(i + 1).join(" "), announceStart);
      return;
    }
  }
}
