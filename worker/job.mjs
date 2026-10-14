#!/usr/bin/env node
/**
 * Worker Flash Motion AI : prend une demande en file et fait tout le travail.
 *  1. script (GPT via KIE)  2. voix off (ElevenLabs via KIE, si demandée)
 *  3. code de l'animation (modèle choisi)  4. rendu  5. envoi de la vidéo
 * Variables : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, KIE_API_KEY, KIE_TTS_VOICE (optionnelle)
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CODE_SYSTEM, SCRIPT_SYSTEM } from "./prompts.mjs";

const exec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));

const SUPA = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const KIE_KEY = process.env.KIE_API_KEY ?? "";
const TTS_MODEL = "elevenlabs/text-to-speech-multilingual-v2";
const TTS_VOICE = process.env.KIE_TTS_VOICE ?? "EkK5I93UQWFDigLMpZcX";
const SCRIPT_MODEL = "claude-haiku-5-5"; // rapide, pour le script
const FORMATS = { vertical: [540, 960], square: [720, 720], landscape: [960, 540] };
const FPS = 24;

if (!SUPA || !SUPA_KEY || !KIE_KEY) {
  console.error("[flash-motion] variables manquantes : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou KIE_API_KEY");
  process.exit(1);
}

const auth = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };
const jsonAuth = { ...auth, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Base de données (REST) ----------
async function rest(path, init = {}) {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, init);
  if (!res.ok) throw new Error(`REST ${res.status} : ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}
async function nextQueued() {
  const rows = await rest("flash_motion_jobs?status=eq.queued&order=created_at.asc&limit=1&select=*", { headers: auth });
  return rows?.[0] ?? null;
}
async function claim(id) {
  const rows = await rest(`flash_motion_jobs?id=eq.${id}&status=eq.queued&select=*`, {
    method: "PATCH",
    headers: { ...jsonAuth, Prefer: "return=representation" },
    body: JSON.stringify({ status: "rendering", updated_at: new Date().toISOString() }),
  });
  return rows?.[0] ?? null;
}
async function updateJob(id, fields) {
  await rest(`flash_motion_jobs?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...jsonAuth, Prefer: "return=minimal" },
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  });
}
async function uploadStorage(path, bytes, contentType) {
  const res = await fetch(`${SUPA}/storage/v1/object/flash-motion/${path}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": contentType, "x-upsert": "true" },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Envoi du fichier échoué (${res.status}) : ${await res.text()}`);
}

// ---------- IA via KIE (avec réessai sur 429) ----------
async function withRetry(fn) {
  let last;
  for (let i = 0; i < 4; i++) {
    try { return await fn(); }
    catch (err) {
      last = err;
      if (!String(err.message).includes("(429)")) throw err;
      await sleep(4000 * (i + 1));
    }
  }
  throw last;
}

async function askModel({ model, system, user, maxTokens = 8000, images = [] }) {
  return withRetry(async () => {
    const headers = { Authorization: `Bearer ${KIE_KEY}`, "Content-Type": "application/json" };
    if (model.startsWith("claude")) {
      const content = images.length
        ? [...images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.mime, data: img.data } })), { type: "text", text: user }]
        : user;
      const res = await fetch("https://api.kie.ai/claude/v1/messages", {
        method: "POST", headers,
        body: JSON.stringify({ model, max_tokens: maxTokens, stream: false, system, messages: [{ role: "user", content }] }),
      });
      const json = await res.json();
      if (!res.ok || (json.code && json.code !== 200)) throw new Error(`Claude indisponible (${res.status})`);
      return (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();
    }
    const content = [
      { type: "input_text", text: user },
      ...images.map((img) => ({ type: "input_image", image_url: `data:${img.mime};base64,${img.data}` })),
    ];
    const res = await fetch("https://api.kie.ai/codex/v1/responses", {
      method: "POST", headers,
      body: JSON.stringify({ model, stream: false, instructions: system, input: [{ role: "user", content }] }),
    });
    const json = await res.json();
    if (!res.ok || (json.code && json.code !== 200)) throw new Error(`GPT indisponible (${res.status})`);
    return (json.output ?? []).filter((o) => o.type === "message").flatMap((o) => o.content ?? [])
      .filter((c) => c.type === "output_text").map((c) => c.text).join("").trim();
  });
}

/** Charge les images de référence depuis le stockage privé (3 maximum). */
async function loadReferences(paths = []) {
  const out = [];
  for (const p of (paths ?? []).slice(0, 3)) {
    const res = await fetch(`${SUPA}/storage/v1/object/flash-motion/${p}`, { headers: auth });
    if (!res.ok) continue;
    const mime = p.endsWith(".png") ? "image/png" : p.endsWith(".webp") ? "image/webp" : "image/jpeg";
    out.push({ mime, data: Buffer.from(await res.arrayBuffer()).toString("base64") });
  }
  return out;
}

const stripFences = (s) => s.replace(/^```(?:html|json)?\s*/i, "").replace(/```\s*$/, "").trim();

// ---------- Voix off ElevenLabs via KIE ----------
async function synthesizeKie(text) {
  const create = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: { Authorization: `Bearer ${KIE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: { text: text.slice(0, 4000), voice: TTS_VOICE, stability: 0.5, similarity_boost: 0.75, style: 0, speed: 1, timestamps: false, previous_text: "", next_text: "" },
    }),
  });
  const created = await create.json();
  const taskId = created?.data?.taskId;
  if (!create.ok || created.code !== 200 || !taskId) throw new Error(`Voix off impossible : ${created?.msg ?? create.status}`);
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const info = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${KIE_KEY}` },
    });
    const data = (await info.json())?.data;
    if (data?.state === "fail") throw new Error(`Voix off échouée : ${data.failMsg ?? "erreur"}`);
    if (data?.state === "success") {
      const parsed = JSON.parse(data.resultJson ?? "{}");
      const url = parsed.resultUrls?.[0];
      if (!url) throw new Error("Voix off : aucun fichier renvoyé");
      const file = await fetch(url);
      const audio = Buffer.from(await file.arrayBuffer());
      const words = parsed.resultObject?.words?.length ? parsed.resultObject.words : null;
      return { audio, words };
    }
  }
  throw new Error("Voix off : délai dépassé");
}

const FAL_KEY = process.env.FAL_KEY ?? "";
const FAL_VOICE = process.env.FAL_TTS_VOICE ?? "Daniel"; // voix ElevenLabs sur fal : Daniel, Brian, Rachel, George, Callum...

/** Voix off via fal.ai (ElevenLabs). Renvoie l'audio ; les timings des mots sont estimés. */
async function synthesizeFal(text) {
  if (!FAL_KEY) throw new Error("fal.ai : FAL_KEY manquante");
  const input = {
    text: text.slice(0, 4000),
    voice: FAL_VOICE,
    stability: 0.4,
    similarity_boost: 0.8,
    style: 0.35,
    speed: 1,
  };
  const res = await fetch("https://fal.run/fal-ai/elevenlabs/tts/multilingual-v2", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  const audioUrl = json?.audio?.url ?? null;
  if (!res.ok || !audioUrl) throw new Error(`fal.ai indisponible (${res.status})`);
  const file = await fetch(audioUrl);
  return { audio: Buffer.from(await file.arrayBuffer()), words: null };
}

/** Fournisseur choisi dans le bureau d'administration (KIE par défaut). */
async function voiceProvider() {
  try {
    const rows = await rest("app_settings?id=eq.global&select=voice_provider", { headers: auth });
    return rows?.[0]?.voice_provider === "fal" ? "fal" : "kie";
  } catch {
    return "kie";
  }
}

/** Essaie le fournisseur choisi, puis l'autre en secours. */
async function generateVoice(text) {
  const first = (await voiceProvider()) === "fal" ? "fal" : "kie";
  const order = first === "fal" ? ["fal", "kie"] : ["kie", "fal"];
  let lastError;
  for (const p of order) {
    try {
      return p === "fal" ? await synthesizeFal(text) : await synthesizeKie(text);
    } catch (err) {
      lastError = err;
      console.error("[flash-motion] voix", p, "échec :", err.message);
    }
  }
  throw lastError;
}

function estimateWords(text, duration) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const step = duration / Math.max(1, words.length);
  return words.map((word, i) => ({ word, start: i * step, end: (i + 1) * step }));
}

// ---------- Rendu ----------
async function renderVideo({ html, seconds, audio, w, h }) {
  const dir = await mkdtemp(join(tmpdir(), "fm-"));
  const htmlPath = join(dir, "scene.html");
  const videoPath = join(dir, "video.mp4");
  await writeFile(htmlPath, html, "utf8");
  const args = [join(here, "render.mjs"), "--html", htmlPath, "--out", videoPath,
    "--duration", String(seconds), "--width", String(w), "--height", String(h), "--fps", String(FPS)];
  if (audio) {
    const audioPath = join(dir, "voix.mp3");
    await writeFile(audioPath, audio);
    args.push("--audio", audioPath);
  }
  await exec("node", args, { timeout: 15 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 });
  return readFile(videoPath);
}

// ---------- Traitement d'une demande ----------
async function processJob(job) {
  const seconds = job.seconds;
  const [W, H] = FORMATS[job.format] ?? FORMATS.vertical;

  await updateJob(job.id, { stage: "Écriture du script", progress: 10 });
  // 1. Script
  const scriptRaw = stripFences(await askModel({
    model: SCRIPT_MODEL, system: SCRIPT_SYSTEM,
    user: `Idée : ${job.idea}\nDurée : ${seconds} secondes`, maxTokens: 1500,
  }));
  const script = JSON.parse(scriptRaw);

  await updateJob(job.id, { stage: "Voix off", progress: 25 });
  // 2. Voix off (si demandée)
  let audio = null;
  let words = [];
  if (job.voice_path) {
    const res = await fetch(`${SUPA}/storage/v1/object/flash-motion/${job.voice_path}`, { headers: auth });
    if (!res.ok) throw new Error("Vocal introuvable");
    audio = Buffer.from(await res.arrayBuffer());
  } else if (job.with_voiceover) {
    let voice = null;
    for (let attempt = 1; attempt <= 3 && !voice; attempt++) {
      try {
        voice = await generateVoice(script.voiceover);
      } catch (err) {
        console.error("[flash-motion] voix tentative", attempt, err.message);
        if (attempt === 3) throw err;
        await sleep(6000 * attempt);
      }
    }
    audio = voice.audio;
    words = voice.words ?? estimateWords(script.voiceover, seconds);
  }

  await updateJob(job.id, { stage: "Création de l'animation", progress: 45 });
  // 3. Code de l'animation, par le modèle choisi
  const userMsg = [
    `Idée : ${job.idea}`,
    `Durée totale : ${seconds} secondes`,
    `Format : ${W} x ${H} pixels`,
    `Scènes proposées : ${JSON.stringify(script.scenes)}`,
    job.voice_path
      ? "Vocal fourni par l'utilisateur : synchroniser les scènes sur sa durée, sans timings de mots."
      : job.with_voiceover
      ? `Voix off : ${script.voiceover}\nTimings des mots (secondes) : ${JSON.stringify(words)}\nDéclare ces mots dans une variable WORDS et utilise FM.wordsVisible(WORDS, t).`
      : "Pas de voix off : ne rien synchroniser avec une voix.",
  ].join("\n");
  const images = await loadReferences(job.reference_paths);
  const refNote = images.length
    ? "\nImages de référence fournies : reproduire leur style, leurs couleurs et leur ambiance dans l'animation."
    : "";
  const html = stripFences(await askModel({ model: job.code_model || "gpt-6-astra", system: CODE_SYSTEM, user: userMsg + refNote, maxTokens: 16000, images }));
  if (!/<!doctype|<html/i.test(html) || !html.includes("<head>") || !html.includes("renderAt")) {
    throw new Error("La composition générée n'est pas valide");
  }
  if (/requestAnimationFrame|setTimeout|setInterval|Math\.random|<script[^>]+src=/i.test(html)) {
    throw new Error("La composition utilise un élément interdit");
  }

  await updateJob(job.id, { stage: "Rendu de la vidéo", progress: 70 });
  // 4. Rendu
  const bytes = await renderVideo({ html, seconds, audio, w: W, h: H });

  await updateJob(job.id, { stage: "Envoi", progress: 92 });
  // 5. Envoi et clôture
  const videoPath = `${job.user_id}/${job.id}.mp4`;
  await uploadStorage(videoPath, bytes, "video/mp4");
  if (audio) await uploadStorage(`${job.user_id}/${job.id}.mp3`, audio, "audio/mpeg");
  await updateJob(job.id, { status: "ready", video_path: videoPath, html: null, stage: "Terminée", progress: 100 });
}

console.log("[flash-motion] worker démarré, surveillance de la file");

while (true) {
  try {
    const next = await nextQueued();
    if (!next) { await sleep(3000); continue; }
    const job = await claim(next.id);
    if (!job) continue;
    console.log("[flash-motion] job pris", job.id);
    try {
      await processJob(job);
      console.log("[flash-motion] prêt", job.id);
    } catch (err) {
      console.error("[flash-motion] échec", job.id, err.message);
      await updateJob(job.id, { status: "failed", error: String(err.message).slice(0, 500) });
    }
  } catch (err) {
    console.error("[flash-motion] erreur de boucle", err.message);
    await sleep(5000);
  }
}
