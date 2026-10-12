import { Mp3Encoder } from "@breezystack/lamejs";

// Gemini TTS only returns 16-bit PCM WAV, ~3.7x the size of the MP3 the old voice produced —
// that's what every reader downloads per chunk and what offline downloads keep on the phone, so
// it's re-encoded once here before being stored. 64 kbps mono is plenty for a single voice.
const KBPS = 64;
const FRAME = 1152 * 8;

export function wavToMp3(wav: Uint8Array): Uint8Array {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const tag = (at: number) => String.fromCharCode(...wav.subarray(at, at + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("not a WAV file");

  let channels = 1;
  let sampleRate = 24000;
  let bits = 16;
  let dataStart = -1;
  let dataLength = 0;
  for (let at = 12; at + 8 <= wav.length; ) {
    const id = tag(at);
    const size = view.getUint32(at + 4, true);
    if (id === "fmt ") {
      channels = view.getUint16(at + 10, true);
      sampleRate = view.getUint32(at + 12, true);
      bits = view.getUint16(at + 22, true);
    } else if (id === "data") {
      dataStart = at + 8;
      // Streamed WAVs can leave the size as a placeholder (0 or 0xFFFFFFFF) — trust the bytes.
      dataLength = Math.min(size || Infinity, wav.length - dataStart);
      break;
    }
    at += 8 + size + (size % 2);
  }
  if (dataStart < 0 || bits !== 16 || channels > 2) throw new Error("unsupported WAV layout");

  const sampleCount = Math.floor(dataLength / 2 / channels);
  const left = new Int16Array(sampleCount);
  const right = channels === 2 ? new Int16Array(sampleCount) : undefined;
  for (let i = 0; i < sampleCount; i++) {
    left[i] = view.getInt16(dataStart + i * 2 * channels, true);
    if (right) right[i] = view.getInt16(dataStart + i * 4 + 2, true);
  }

  const encoder = new Mp3Encoder(channels, sampleRate, KBPS);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < sampleCount; i += FRAME) {
    parts.push(encoder.encodeBuffer(left.subarray(i, i + FRAME), right?.subarray(i, i + FRAME)));
  }
  parts.push(encoder.flush());

  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
