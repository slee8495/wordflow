// Nightly "영상으로 보기" film maker — runs on the operator's Mac (launchd 02:00, see
// scripts/film/nightly.sh), never on Vercel.
//
// 1. Works out what the operator's profile will read next: the reading on screen now plus the next
//    AHEAD (3) — upcoming season days (Thanksgiving/Christmas/Holy Week override the rotation, see
//    src/lib/season.ts) first, then the normal curriculum after the last revealed reading.
// 2. For each without a ready film: reuses the saved script if one exists (a passage seen on an
//    earlier cycle), otherwise asks `claude -p` once for a scene script; narrates each sentence
//    with the app's own /api/speak voice; renders stills + motion locally (render.py); uploads the
//    mp4/poster to Vercel Blob; marks the films row ready.
// 3. Every ready film that is no longer in that window gets its video deleted from Blob — the
//    script stays, so coming back around the curriculum just re-renders it.
//
// Usage: npx tsx --env-file=.env.local scripts/film/nightly.ts [--item <curriculumItemId>] [--dry]
// FILM_ALLOW_CLAUDE=0 (set by nightly.sh when the control tower says skip) → no new scripts this run.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { and, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { del, put } from "@vercel/blob";
import { db } from "@/db";
import { curriculumItems, films, profiles, readings, users, type CurriculumItem, type FilmScript } from "@/db/schema";
import { peekCurrentCurriculumItem } from "@/lib/generateReading";
import { profileDateString, shiftDateString } from "@/lib/date";
import { getActiveSeason } from "@/lib/season";
import { fetchNltPassage } from "@/lib/bible";
import { spellOutKoreanNumbers } from "@/lib/koreanNumbers";
import { formatPassageRefKorean } from "@/lib/passageRef";

// How many readings past the current one to keep filmed. 2026-11-25 the user tried 10, then went back
// to 3: "10일치는 너무 무리인듯 하다 맥북한테도 … 부족하다 싶으면 그때 다시 늘리자".
const AHEAD = Number(process.env.FILM_AHEAD ?? 3);
const HOME = path.join(os.homedir(), ".slstudio/wordflow-film");
const WORK = path.join(HOME, "work");
const PY = path.join(HOME, "venv/bin/python");
const SPEAK_URL = process.env.FILM_SPEAK_URL ?? "https://wordflow.sl-studio.dev/api/speak";
const CLAUDE = process.env.CLAUDE_BIN ?? "claude";

const STYLE =
  "Photorealistic cinematic film still, shot on ARRI Alexa 65 with anamorphic lens, historically accurate " +
  "biblical-era Near East, authentic Near Eastern people with olive and brown skin, coarse undyed wool and linen " +
  "robes, natural skin texture, real dust and wear, natural light, muted earthy color grade, subtle film grain, " +
  "epic biblical drama, simple uncluttered composition";

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(5, 16), ...a);

// ---------- what to have ready ----------

async function operatorProfile() {
  const email = process.env.FILM_PROFILE_EMAIL ?? process.env.ADMIN_EMAIL;
  if (!email) throw new Error("FILM_PROFILE_EMAIL / ADMIN_EMAIL not set");
  const [row] = await db
    .select({ profile: profiles })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(eq(users.email, email))
    .limit(1);
  if (!row) throw new Error("operator profile not found");
  return row.profile;
}

export async function computeTargets(): Promise<CurriculumItem[]> {
  const profile = await operatorProfile();
  const out: CurriculumItem[] = [];
  const push = (it: CurriculumItem | null | undefined) => {
    if (it && !out.some((o) => o.id === it.id)) out.push(it);
  };

  push(await peekCurrentCurriculumItem(profile));

  const today = profileDateString(profile);
  for (let d = 1; d <= AHEAD; d++) {
    const s = getActiveSeason(shiftDateString(today, d));
    if (!s) continue;
    const [it] = await db
      .select()
      .from(curriculumItems)
      .where(and(eq(curriculumItems.season, s.season), eq(curriculumItems.seasonDayIndex, s.dayIndex)))
      .limit(1);
    push(it);
  }

  const [total] = await db
    .select({ n: sql<number>`count(*)` })
    .from(curriculumItems)
    .where(isNull(curriculumItems.season));
  const len = Number(total?.n ?? 0);
  const [last] = await db
    .select({ orderIndex: curriculumItems.orderIndex })
    .from(readings)
    .innerJoin(curriculumItems, eq(curriculumItems.id, readings.curriculumItemId))
    .where(and(eq(readings.profileId, profile.id), eq(readings.revealed, true), isNull(curriculumItems.season)))
    .orderBy(desc(readings.createdAt))
    .limit(1);
  let pos = last ? last.orderIndex : profile.cursorPosition - 1;
  for (let guard = 0; out.length < 1 + AHEAD && guard < 20 && len > 0; guard++) {
    pos = (pos + 1) % len;
    const [it] = await db
      .select()
      .from(curriculumItems)
      .where(and(eq(curriculumItems.orderIndex, pos), isNull(curriculumItems.season)))
      .limit(1);
    push(it);
  }
  return out.slice(0, 1 + AHEAD);
}

// ---------- script (the only Claude step) ----------

function sentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+["'‘’“”]*|[^.!?]+$/g) ?? [text]).map((s) => s.trim()).filter(Boolean);
}

const norm = (s: string) => s.replace(/\s+/g, "");

async function koreanStoryFor(item: CurriculumItem): Promise<string | null> {
  const [r] = await db
    .select({ ko: readings.passageTextKoStory })
    .from(readings)
    .where(eq(readings.curriculumItemId, item.id))
    .limit(1);
  return r?.ko ?? null;
}

function claudeJson(prompt: string): unknown {
  const res = spawnSync(CLAUDE, ["-p", prompt, "--model", "opus", "--output-format", "text"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    timeout: 20 * 60 * 1000,
  });
  if (res.status !== 0) throw new Error(`claude -p failed: ${res.stderr?.slice(0, 500)}`);
  const s = res.stdout;
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("claude -p returned no JSON");
  return JSON.parse(s.slice(a, b + 1));
}

async function writeScript(item: CurriculumItem): Promise<FilmScript> {
  const existingKo = await koreanStoryFor(item);
  const en = await fetchNltPassage(item.passageRef).catch(() => null);
  const prompt = [
    `You are the director of a photorealistic Bible film for the reading app Wordflow. Passage: ${item.passageRef}.`,
    existingKo
      ? `This is the Korean narration, already shown in the app — use it EXACTLY, word for word, do not change it:\n${existingKo}`
      : `First translate the passage into natural, easy Korean story prose (쉬운성경 style, plain 평서체 '-다' endings, every verse included, nothing invented, faithful to the NLT):`,
    en ? `NLT text:\n${en}` : "",
    `Then split that Korean narration, in order and without changing a single character, into consecutive scenes (one scene per ~2-4 sentences; 3 to 14 scenes). Concatenating every scene's "text" must give back the full narration.`,
    `For each scene write an English image prompt for a photorealistic still (an AI image model will render it): one concrete, filmable moment — who, where, action, light, camera framing. Historically accurate setting and costume for this book's era. Real people, never cartoon. Describe only what IS in the frame; never write "no X" (the image model adds anything you name). For laws, poetry or letters, show the people who lived them (a family, a farmer, a scribe, a congregation) rather than abstractions. Depict God only through light, fire, cloud or wind, never as a person. Keep violence implied, never gore. Keep recurring characters described consistently across scenes.`,
    `Reply with ONLY this JSON: {"title": "<Korean passage name · short Korean theme>", "scenes": [{"text": "<Korean narration for this scene>", "prompt": "<English image prompt>"}]}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = claudeJson(prompt) as { title?: string; scenes?: { text?: string; prompt?: string }[] };
  const scenes = (raw.scenes ?? []).filter((s) => s.text?.trim() && s.prompt?.trim());
  if (scenes.length < 2) throw new Error("script has too few scenes");
  const joined = norm(scenes.map((s) => s.text!).join(""));
  if (existingKo && joined !== norm(existingKo)) {
    throw new Error("script narration does not match the app's Korean text");
  }
  return {
    title: raw.title?.trim() || formatPassageRefKorean(item.passageRef),
    style: STYLE,
    scenes: scenes.map((s, i) => ({ text: s.text!.trim(), prompt: s.prompt!.trim(), seed: 100 + i })),
  };
}

// ---------- narration ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function narrate(text: string, dir: string): Promise<string> {
  const spoken = spellOutKoreanNumbers(text);
  const file = path.join(dir, createHash("sha1").update(spoken).digest("hex").slice(0, 16) + ".mp3");
  if (fs.existsSync(file)) return file;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${SPEAK_URL}?text=${encodeURIComponent(spoken)}`, { redirect: "follow" });
    if (res.ok && (res.headers.get("content-type") ?? "").includes("audio")) {
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      await sleep(1600); // stay under /api/speak's 40-per-minute limit on fresh generations
      return file;
    }
    log(`  tts ${res.status}, retrying`);
    await sleep(res.status === 429 ? 30000 : 5000);
  }
  throw new Error(`tts failed for: ${text.slice(0, 40)}`);
}

// ---------- render + upload ----------

async function render(item: CurriculumItem, script: FilmScript) {
  const wd = path.join(WORK, String(item.id));
  const ttsDir = path.join(wd, "tts");
  fs.mkdirSync(ttsDir, { recursive: true });
  // A changed script must not reuse stills drawn from the old prompts.
  const sig = createHash("sha1").update(JSON.stringify(script)).digest("hex");
  const sigFile = path.join(wd, "script.sig");
  if (fs.existsSync(sigFile) && fs.readFileSync(sigFile, "utf8") !== sig) {
    fs.rmSync(path.join(wd, "images"), { recursive: true, force: true });
  }
  fs.writeFileSync(sigFile, sig);

  const scenes = [];
  for (const sc of script.scenes) {
    const segments = [];
    for (const s of sentences(sc.text)) segments.push({ text: s, audio: await narrate(s, ttsDir) });
    scenes.push({ prompt: sc.prompt, seed: sc.seed, segments });
  }
  const plan = { workdir: wd, title: script.title, style: script.style, scenes };
  const planFile = path.join(wd, "plan.json");
  fs.writeFileSync(planFile, JSON.stringify(plan, null, 1));
  const r = spawnSync(PY, [path.join(__dirname, "render.py"), planFile], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("render.py failed");

  const stamp = Date.now();
  const video = await put(`films/${item.id}/${stamp}.mp4`, fs.createReadStream(path.join(wd, "film.mp4")), {
    access: "public",
    contentType: "video/mp4",
    multipart: true,
    cacheControlMaxAge: 31536000,
  });
  const poster = await put(`films/${item.id}/${stamp}.jpg`, fs.readFileSync(path.join(wd, "poster.jpg")), {
    access: "public",
    contentType: "image/jpeg",
    cacheControlMaxAge: 31536000,
  });
  const cues = JSON.parse(fs.readFileSync(path.join(wd, "cues.json"), "utf8"));
  const { durationSec } = JSON.parse(fs.readFileSync(path.join(wd, "meta.json"), "utf8"));
  // Clips are big and only needed until upload; stills + narration stay for a cheap re-render.
  fs.rmSync(path.join(wd, "clips"), { recursive: true, force: true });
  fs.rmSync(path.join(wd, "film.mp4"), { force: true });
  return { videoUrl: video.url, posterUrl: poster.url, cues, durationSec };
}

// ---------- main ----------

async function makeFilm(item: CurriculumItem, allowClaude: boolean, dry: boolean) {
  const [film] = await db.select().from(films).where(eq(films.curriculumItemId, item.id)).limit(1);
  if (film?.status === "ready" && film.videoUrl) return log(`ready   ${item.passageRef}`);
  if (dry) return log(`todo    ${item.passageRef} (${film ? "has script" : "needs script"})`);

  let script = film?.script;
  if (!script) {
    if (!allowClaude) return log(`skip    ${item.passageRef} (needs a script, Claude not allowed this run)`);
    log(`script  ${item.passageRef}`);
    script = await writeScript(item);
    await db
      .insert(films)
      .values({ curriculumItemId: item.id, status: "archived", script })
      .onConflictDoUpdate({ target: films.curriculumItemId, set: { script, updatedAt: new Date() } });
  }
  log(`render  ${item.passageRef} (${script.scenes.length} scenes)`);
  const out = await render(item, script);
  await db
    .update(films)
    .set({ status: "ready", ...out, updatedAt: new Date() })
    .where(eq(films.curriculumItemId, item.id));
  log(`done    ${item.passageRef} ${Math.round(out.durationSec)}s`);
}

async function purge(keepIds: number[], dry: boolean) {
  const stale = await db
    .select()
    .from(films)
    .where(keepIds.length ? and(eq(films.status, "ready"), notInArray(films.curriculumItemId, keepIds)) : eq(films.status, "ready"));
  for (const f of stale) {
    log(`archive item ${f.curriculumItemId}`);
    if (dry) continue;
    const urls = [f.videoUrl, f.posterUrl].filter((u): u is string => !!u);
    if (urls.length) await del(urls).catch((e) => log("  blob delete failed", String(e)));
    await db
      .update(films)
      .set({ status: "archived", videoUrl: null, posterUrl: null, cues: null, updatedAt: new Date() })
      .where(eq(films.id, f.id));
    fs.rmSync(path.join(WORK, String(f.curriculumItemId)), { recursive: true, force: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const allowClaude = process.env.FILM_ALLOW_CLAUDE !== "0";
  const only = args.includes("--item") ? Number(args[args.indexOf("--item") + 1]) : null;

  let targets: CurriculumItem[];
  if (only) {
    targets = await db.select().from(curriculumItems).where(inArray(curriculumItems.id, [only]));
  } else {
    targets = await computeTargets();
  }
  log("targets:", targets.map((t) => `${t.id}:${t.passageRef}`).join(", "));

  let failed = 0;
  for (const item of targets) {
    try {
      await makeFilm(item, allowClaude, dry);
    } catch (e) {
      failed++;
      log(`FAILED  ${item.passageRef}:`, e instanceof Error ? e.message : e);
    }
  }
  if (!only) await purge(targets.map((t) => t.id), dry);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
