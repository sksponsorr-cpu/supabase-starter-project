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
const W = 540, H = 960, FPS = 24; // aperçu rapide ; repasser à 1080x1920 pour la qualité finale

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

async function askModel({ model, system, user, maxTokens = 8000 }) {
  return withRetry(async () => {
    const headers = { Authorization: `Bearer ${KIE_KEY}`, "Content-Type": "application/json" };
    if (model.startsWith("claude")) {
      const res = await fetch("https://api.kie.ai/claude/v1/messages", {
        method: "POST", headers,
        body: JSON.stringify({ model, max_tokens: maxTokens, stream: false, system, messages: [{ role: "user", content: user }] }),
      });
      const json = await res.json();
      if (!res.ok || (json.code && json.code !== 200)) throw new Error(`Claude indisponible (${res.status})`);
      return (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();
    }
    const res = await fetch("https://api.kie.ai/codex/v1/responses", {
      method: "POST", headers,
      body: JSON.stringify({ model, stream: false, instructions: system, input: [{ role: "user", content: [{ type: "input_text", text: user }] }] }),
    });
    const json = await res.json();
    if (!res.ok || (json.code && json.code !== 200)) throw new Error(`GPT indisponible (${res.status})`);
    return (json.output ?? []).filter((o) => o.type === "message").flatMap((o) => o.content ?? [])
      .filter((c) => c.type === "output_text").map((c) => c.text).join("").trim();
  });
}

const stripFences = (s) => s.replace(/^```(?:html|json)?\s*/i, "").replace(/```\s*$/, "").trim();

// ---------- Voix off ElevenLabs via KIE ----------
async function synthesize(text) {
  const create = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: { Authorization: `Bearer ${KIE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: { text: text.slice(0, 4000), voice: TTS_VOICE, stability: 0.5, similarity_boost: 0.75, style: 0, speed: 1, timestamps: true, previous_text: "", next_text: "" },
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

function estimateWords(text, duration) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const step = duration / Math.max(1, words.length);
  return words.map((word, i) => ({ word, start: i * step, end: (i + 1) * step }));
}

// ---------- Rendu ----------
async function renderVideo({ html, seconds, audio }) {
  const dir = await mkdtemp(join(tmpdir(), "fm-"));
  const htmlPath = join(dir, "scene.html");
  const videoPath = join(dir, "video.mp4");
  await writeFile(htmlPath, html, "utf8");
  const args = [join(here, "render.mjs"), "--html", htmlPath, "--out", videoPath,
    "--duration", String(seconds), "--width", String(W), "--height", String(H), "--fps", String(FPS)];
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

  // 1. Script
  const scriptRaw = stripFences(await askModel({
    model: SCRIPT_MODEL, system: SCRIPT_SYSTEM,
    user: `Idée : ${job.idea}\nDurée : ${seconds} secondes`, maxTokens: 1500,
  }));
  const script = JSON.parse(scriptRaw);

  // 2. Voix off (si demandée)
  let audio = null;
  let words = [];
  if (job.with_voiceover) {
    const voice = await synthesize(script.voiceover);
    audio = voice.audio;
    words = voice.words ?? estimateWords(script.voiceover, seconds);
  }

  // 3. Code de l'animation, par le modèle choisi
  const userMsg = [
    `Idée : ${job.idea}`,
    `Durée totale : ${seconds} secondes`,
    `Format : ${W} x ${H} pixels`,
    `Scènes proposées : ${JSON.stringify(script.scenes)}`,
    job.with_voiceover
      ? `Voix off : ${script.voiceover}\nTimings des mots (secondes) : ${JSON.stringify(words)}\nDéclare ces mots dans une variable WORDS et utilise FM.wordsVisible(WORDS, t).`
      : "Pas de voix off : ne rien synchroniser avec une voix.",
  ].join("\n");
  const html = stripFences(await askModel({ model: job.code_model || "gpt-6-astra", system: CODE_SYSTEM, user: userMsg, maxTokens: 16000 }));
  if (!/<!doctype|<html/i.test(html) || !html.includes("<head>") || !html.includes("renderAt")) {
    throw new Error("La composition générée n'est pas valide");
  }
  if (/requestAnimationFrame|setTimeout|setInterval|Math\.random|<script[^>]+src=/i.test(html)) {
    throw new Error("La composition utilise un élément interdit");
  }

  // 4. Rendu
  const bytes = await renderVideo({ html, seconds, audio });

  // 5. Envoi et clôture
  const videoPath = `${job.user_id}/${job.id}.mp4`;
  await uploadStorage(videoPath, bytes, "video/mp4");
  if (audio) await uploadStorage(`${job.user_id}/${job.id}.mp3`, audio, "audio/mpeg");
  await updateJob(job.id, { status: "ready", video_path: videoPath, html: null });
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
