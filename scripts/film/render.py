"""Renders one film from a plan the nightly orchestrator (scripts/film/nightly.ts) prepared.

Input plan.json:
  {"workdir": ..., "title": "...", "style": "...",
   "scenes": [{"prompt": "...", "seed": 101, "segments": [{"text": "...", "audio": "x.mp3"}]}]}

Per scene: a photoreal still from Z-Image Turbo (mflux, local, free), slow camera motion
(ffmpeg zoompan), 1s crossfades. Narration (the app's own /api/speak voice, already fetched as
one mp3 per sentence) is laid on a single track, and each scene lasts exactly as long as its
narration. Writes film.mp4 (video+audio, no burned-in text), poster.jpg, and cues.json — subtitle
cues the app shows under the video, split into short cards and timed to the narration.

Needs ffmpeg and the venv at ~/.slstudio/wordflow-film/venv (pip install mflux); this file itself
is stdlib-only."""
import json, re, subprocess, sys
from pathlib import Path

VENV = Path.home() / ".slstudio/wordflow-film/venv"
W, H, FPS, X = 1344, 768, 30, 1.0
LEAD_FIRST, LEAD, GAP, TAIL = 3.0, 0.6, 0.45, 1.0
SR = 24000


def run(*args):
    subprocess.run([str(a) for a in args], check=True)


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         check=True, capture_output=True, text=True).stdout.strip()
    return float(out)


def cards_for(sentence):
    """Split a long sentence into subtitle cards of roughly two short lines each."""
    if len(sentence) <= 60:
        return [sentence]
    parts, cur = [], ""
    for chunk in re.split(r"(?<=[,—])\s*", sentence):
        if cur and len(cur) + len(chunk) > 56:
            parts.append(cur.strip())
            cur = chunk
        else:
            cur += (" " if cur and not cur.endswith("—") else "") + chunk
    if cur.strip():
        parts.append(cur.strip())
    return parts


def gen_image(prompt, out, seed):
    if out.exists():
        return
    run(VENV / "bin/mflux-generate-z-image-turbo", "-q", "4", "--low-ram", "--steps", "9",
        "--width", W, "--height", H, "--seed", seed, "--prompt", prompt, "--output", out)


MOVES = ["in_center", "out_center", "pan_right", "in_left", "pan_left", "out_right"]


def motion_clip(image, seconds, move, out):
    frames = int(round(seconds * FPS))
    zin, zout = f"1+0.12*on/{frames}", f"1.12-0.12*on/{frames}"
    mid_x, mid_y = "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    z, x, y = {
        "in_center": (zin, mid_x, mid_y),
        "out_center": (zout, mid_x, mid_y),
        "pan_right": ("1.12", f"(iw-iw/zoom)*on/{frames}", mid_y),
        "pan_left": ("1.12", f"(iw-iw/zoom)*(1-on/{frames})", mid_y),
        "in_left": (zin, "0", mid_y),
        "out_right": (zout, "iw-iw/zoom", mid_y),
    }[move]
    vf = f"scale={W*4}:{H*4},zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s={W}x{H}:fps={FPS},format=yuv420p"
    run("ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-i", image, "-vf", vf, "-frames:v", frames,
        "-c:v", "libx264", "-crf", "18", "-preset", "medium", out)


def silence(seconds, out):
    run("ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono",
        "-t", f"{max(seconds, 0.01):.3f}", "-c:a", "pcm_s16le", out)


def to_wav(src, out):
    run("ffmpeg", "-y", "-loglevel", "error", "-i", src, "-ar", SR, "-ac", 1, "-c:a", "pcm_s16le", out)


def main(plan_path):
    plan = json.load(open(plan_path))
    wd = Path(plan["workdir"])
    for sub in ("images", "clips", "audio"):
        (wd / sub).mkdir(parents=True, exist_ok=True)
    scenes = plan["scenes"]

    # 1. Timeline from narration lengths.
    t, starts, cues, track = 0.0, [], [], []  # track: list of (kind, value) to concat in order
    cursor = 0.0  # where the audio track currently ends
    for i, sc in enumerate(scenes):
        starts.append(t)
        lead = LEAD_FIRST if i == 0 else (X + LEAD)
        speech_t = t + lead
        if i == 0:
            cues.append({"start": 0.3, "end": LEAD_FIRST - 0.2, "text": plan["title"]})
        for seg in sc["segments"]:
            wav = wd / "audio" / (Path(seg["audio"]).stem + ".wav")
            to_wav(seg["audio"], wav)
            d = duration(wav)
            track.append(("sil", speech_t - cursor))
            track.append(("wav", wav))
            cards = cards_for(seg["text"])
            total_chars = sum(len(c) for c in cards)
            ct = speech_t
            for c in cards:
                cd = d * len(c) / total_chars
                cues.append({"start": round(ct, 2), "end": round(ct + cd, 2), "text": c})
                ct += cd
            cursor = speech_t + d
            speech_t = cursor + GAP
        scene_len = (cursor + TAIL) - t + (X if i < len(scenes) - 1 else 0.5)
        sc["len"] = scene_len
        t += scene_len - X
    total = starts[-1] + scenes[-1]["len"]
    track.append(("sil", total - cursor))

    # 2. Audio track.
    parts = []
    for k, (kind, val) in enumerate(track):
        if kind == "sil":
            p = wd / "audio" / f"sil{k:03d}.wav"
            silence(val, p)
            parts.append(p)
        else:
            parts.append(val)
    lst = wd / "audio" / "concat.txt"
    lst.write_text("".join(f"file '{p}'\n" for p in parts))
    narration = wd / "narration.wav"
    run("ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c:a", "pcm_s16le", narration)

    # 3. Images + motion clips.
    for i, sc in enumerate(scenes):
        img = wd / "images" / f"{i:02d}.png"
        gen_image(plan["style"] + ". " + sc["prompt"], img, sc["seed"])
        motion_clip(img, sc["len"], MOVES[i % len(MOVES)], wd / "clips" / f"{i:02d}.mp4")

    # 4. Crossfade chain + narration → film.mp4
    inputs, filt, prev = [], [], "[0:v]"
    for i in range(len(scenes)):
        inputs += ["-i", str(wd / "clips" / f"{i:02d}.mp4")]
    for i in range(1, len(scenes)):
        filt.append(f"{prev}[{i}:v]xfade=transition=fade:duration={X}:offset={starts[i]:.3f}[v{i}]")
        prev = f"[v{i}]"
    inputs += ["-i", str(narration)]
    out = wd / "film.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", *inputs]
    if filt:
        cmd += ["-filter_complex", ";".join(filt), "-map", prev]
    else:
        cmd += ["-map", "0:v"]
    cmd += ["-map", f"{len(scenes)}:a", "-t", f"{total:.2f}", "-c:v", "libx264", "-crf", "24", "-preset", "medium",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(out)]
    run(*cmd)
    run("ffmpeg", "-y", "-loglevel", "error", "-i", wd / "images" / "00.png", "-vf", "scale=960:-2", "-q:v", "4",
        wd / "poster.jpg")
    (wd / "cues.json").write_text(json.dumps(cues, ensure_ascii=False))
    (wd / "meta.json").write_text(json.dumps({"durationSec": round(duration(out), 2)}))
    print(out, f"{total:.1f}s")


if __name__ == "__main__":
    main(sys.argv[1])
