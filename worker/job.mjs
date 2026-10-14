#!/usr/bin/env node
/**
 * Worker Flash Motion AI : prend une demande en file et fait tout le travail.
 *  1. script (GPT ou Claude)  2. voix off (KIE ou fal), durée réelle et timings des mots
 *  3. composition (modèle choisi)  4. rendu avec contrôle de mouvement  5. effets sonores  6. envoi
 * Variables : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, KIE_API_KEY, FAL_KEY, KIE_TTS_VOICE, FAL_TTS_VOICE
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, mkdtemp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CODE_SYSTEM, SCRIPT_SYSTEM, REVIEW_SYSTEM } from "./prompts.mjs";
import { audioDuration, transcribeWords } from "./voice.mjs";
import { inspectComposition } from "./verify.mjs";

const exec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));

const SUPA = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const KIE_KEY = process.env.KIE_API_KEY ?? "";
const FAL_KEY = process.env.FAL_KEY ?? "";
const TTS_MODEL = "elevenlabs/text-to-speech-multilingual-v2";
const TTS_VOICE = process.env.KIE_TTS_VOICE ?? "EkK5I93UQWFDigLMpZcX";
const FAL_VOICE = process.env.FAL_TTS_VOICE ?? "Daniel";
const SCRIPT_MODEL = "claude-haiku-5-5"; // rapide, pour le script
const FORMATS = { vertical: [540, 960], square: [720, 720], landscape: [960, 540] };
const FPS = 24;
const MAX_TAIL = 1; // secondes de fin après la voix

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

async function askKie({ model, system, user, maxTokens = 8000, images = [] }) {
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
    if (!res.ok) {
      console.error("[flash-motion] référence introuvable (", res.status, ") :", p);
      continue;
    }
    const mime = p.endsWith(".png") ? "image/png" : p.endsWith(".webp") ? "image/webp" : "image/jpeg";
    out.push({ mime, data: Buffer.from(await res.arrayBuffer()).toString("base64") });
  }
  console.log("[flash-motion] références chargées :", out.length, "sur", (paths ?? []).length);
  return out;
}

const stripFences = (s) => s.replace(/^```(?:html|json)?\s*/i, "").replace(/```\s*$/, "").trim();

// ---------- Modèles Claude / GPT : KIE ou fal.ai (OpenRouter) ----------
const FAL_MODEL = {
  "gpt-6-astra": "openai/gpt-6-astra",
  "claude-sonnet-5-5": "anthropic/claude-sonnet-5",
  "claude-opus-4-8": "anthropic/claude-opus-5.5",
  "claude-haiku-5-5": "anthropic/claude-sonnet-5",
};

async function askFal({ model, system, user, images = [] }) {
  if (!FAL_KEY) throw new Error("fal : FAL_KEY manquante");
  const body = { prompt: user, system_prompt: system, model: FAL_MODEL[model] ?? "openai/gpt-6-astra" };
  const endpoint = images.length ? "https://fal.run/openrouter/router/vision" : "https://fal.run/openrouter/router";
  if (images.length) body.image_urls = images.map((img) => `data:${img.mime};base64,${img.data}`);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || typeof json.output !== "string") throw new Error(`fal indisponible (${res.status})`);
  return json.output.trim();
}

/** Fournisseur des modèles choisi dans le bureau d'administration (KIE par défaut). */
async function codeProvider() {
  try {
    const rows = await rest("app_settings?id=eq.global&select=code_provider", { headers: auth });
    return rows?.[0]?.code_provider === "fal" ? "fal" : "kie";
  } catch {
    return "kie";
  }
}

/** Essaie le fournisseur choisi, puis l'autre en secours. */
async function askModel(args) {
  const first = (await codeProvider()) === "fal" ? "fal" : "kie";
  const order = first === "fal" ? ["fal", "kie"] : ["kie", "fal"];
  let lastError;
  for (const p of order) {
    try {
      return p === "fal" ? await askFal(args) : await askKie(args);
    } catch (err) {
      lastError = err;
      console.error("[flash-motion] modèle", p, "échec :", err.message);
    }
  }
  throw lastError;
}

// ---------- Voix off : KIE ou fal.ai (ElevenLabs), avec timings si disponibles ----------
async function synthesizeKie(text) {
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

async function synthesizeFal(text) {
  if (!FAL_KEY) throw new Error("fal.ai : FAL_KEY manquante");
  const res = await fetch("https://fal.run/fal-ai/elevenlabs/tts/multilingual-v2", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.slice(0, 4000), voice: FAL_VOICE, stability: 0.4, similarity_boost: 0.8, style: 0.35, speed: 1 }),
  });
  const json = await res.json();
  const audioUrl = json?.audio?.url ?? null;
  if (!res.ok || !audioUrl) throw new Error(`fal.ai indisponible (${res.status})`);
  const file = await fetch(audioUrl);
  return { audio: Buffer.from(await file.arrayBuffer()), words: null };
}

/** Fournisseur de voix choisi dans le bureau d'administration (KIE par défaut). */
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

/** Répartit les secondes des scènes pour que leur total égale la durée de la vidéo. */
function scaleScenes(scenes, total) {
  const sum = scenes.reduce((a, s) => a + (Number(s.seconds) || 0), 0);
  if (!sum) return scenes.map((s) => ({ ...s, seconds: total / scenes.length }));
  const k = total / sum;
  return scenes.map((s) => ({ ...s, seconds: Math.round((Number(s.seconds) || 0) * k * 10) / 10 }));
}

// ---------- Revue visuelle : le modèle regarde le rendu et juge ----------
async function reviewVisually({ job, scenes, frames }) {
  const storyboard = scenes.map((sc, i) => `${i + 1}. ${sc.text} | ${sc.visual ?? ""} | ${sc.camera ?? ""}`).join("\n");
  const user = `Vidéo demandée : ${job.idea}\nStoryboard :\n${storyboard}\nImages clés du rendu actuel (dans l'ordre : 25 %, 50 %, 80 % de la durée) jointes.`;
  const raw = stripFences(await askModel({
    model: job.code_model || "gpt-6-astra",
    system: REVIEW_SYSTEM,
    user,
    maxTokens: 1500,
    images: frames,
  }));
  try {
    const verdict = JSON.parse(raw);
    return { ok: verdict.ok === true, issues: Array.isArray(verdict.issues) ? verdict.issues : [] };
  } catch {
    console.error("[flash-motion] revue illisible, rendu accepté :", raw.slice(0, 120));
    return { ok: true, issues: [] };
  }
}

// ---------- Composition HTML (modèle choisi) ----------
async function generateComposition({ job, seconds, W, H, scenes, words, withWords, hasVoice, images, refNote, feedback, previousHtml }) {
  const userMsg = [
    feedback && previousHtml ? `Code précédent à corriger (garde ce qui marche, change ce qui est signalé) :\n${previousHtml.slice(0, 30000)}` : "",
    `Idée : ${job.idea}`,
    `Durée totale : ${seconds} secondes`,
    `Format : ${W} x ${H} pixels`,
    `Scènes (durées calées sur la voix) : ${JSON.stringify(scenes)}`,
    withWords
      ? `Timings des mots (secondes) : ${JSON.stringify(words)}\nDéclare ces mots dans une variable WORDS. Pour chaque mot i, utilise FM.wordProgress(WORDS, t, i) pour son apparition.`
      : hasVoice
      ? "Vocal sans timings de mots : synchroniser les scènes sur sa durée totale, sans découper les mots."
      : "Pas de voix off : ne rien synchroniser avec une voix.",
    feedback ? `Consigne de correction : ${feedback}` : "",
  ].filter(Boolean).join("\n");

  const html = stripFences(await askModel({
    model: job.code_model || "gpt-6-astra",
    system: CODE_SYSTEM,
    user: userMsg + refNote,
    maxTokens: 16000,
    images,
  }));
  if (!/<!doctype|<html/i.test(html) || !html.includes("<head>") || !html.includes("renderAt")) {
    const err = new Error("La composition générée n'est pas valide");
    err.retryable = true;
    err.refusal = html.slice(0, 200);
    throw err;
  }
  const forbidden = html.match(/requestAnimationFrame|setTimeout|setInterval|Math\.random|performance\.now|<script[^>]+src=|@keyframes|backdrop-filter/i);
  if (forbidden) {
    const err = new Error(`La composition utilise un élément interdit : ${forbidden[0]}`);
    err.retryable = true;
    err.forbidden = forbidden[0];
    throw err;
  }
  return html;
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
  let seconds = job.seconds;
  const [W, H] = FORMATS[job.format] ?? FORMATS.vertical;

  // Mode « page prête » : la page fournie est rendue telle quelle, sans modèle.
  if (job.code_model === "prebuilt" && job.html) {
    await updateJob(job.id, { stage: "Rendu de la vidéo", progress: 60 });
    const rendered = await renderVideo({ html: job.html, seconds, audio: null, w: W, h: H });
    await updateJob(job.id, { stage: "Envoi", progress: 92 });
    const videoPath = `${job.user_id}/${job.id}.mp4`;
    await uploadStorage(videoPath, rendered, "video/mp4");
    await updateJob(job.id, { status: "ready", video_path: videoPath, html: null, stage: "Terminée", progress: 100 });
    return;
  }

  // 1. Script
  await updateJob(job.id, { stage: "Écriture du script", progress: 10 });
  const scriptRaw = stripFences(await askModel({
    model: SCRIPT_MODEL, system: SCRIPT_SYSTEM,
    user: `Idée : ${job.idea}\nDurée : ${seconds} secondes`, maxTokens: 1500,
  }));
  const script = JSON.parse(scriptRaw);

  // 2. Voix off : durée réelle et timings des mots
  await updateJob(job.id, { stage: "Voix off", progress: 25 });
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
    words = voice.words ?? [];
  }

  // La vidéo suit la voix réelle : sa durée remplace la durée demandée.
  if (audio) {
    const real = await audioDuration(audio);
    seconds = Math.min(Math.max(job.seconds, Math.ceil(real * 10) / 10 + MAX_TAIL), 60);
    if (!words.length) {
      try {
        words = (await transcribeWords(audio)) ?? [];
      } catch (err) {
        console.error("[flash-motion] transcription échouée :", err.message);
        words = [];
      }
    }
    // Les mots estimés ne servent que pour la voix générée par nous, dont on connaît le texte.
    if (!words.length && job.with_voiceover && !job.voice_path) {
      words = estimateWords(script.voiceover, real);
    }
    console.log("[flash-motion] voix", real.toFixed(2), "s, mots :", words.length);
  }

  const scenes = scaleScenes(script.scenes, seconds);
  const withWords = words.length > 0;
  const hasVoice = !!audio;

  // 3, 4. Composition, contrôle automatique et correction, puis rendu
  let refImages = await loadReferences(job.reference_paths);
  const refNote = refImages.length
    ? "\nImages de référence fournies : reproduire leur style, leurs couleurs et leur ambiance dans l'animation."
    : "";
  const requiredTexts = [...new Set(scenes.flatMap((sc) => [sc.text, sc.keyword]).filter(Boolean))];
  let rendered = null;
  let feedback = "";
  let reviewImages = [];
  let previousHtml = null;
  // Opus corrige mieux à partir d'une image : on lui laisse une tentative de plus.
  const MAX_ATTEMPTS = String(job.code_model || "").includes("opus") ? 4 : 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await updateJob(job.id, { stage: "Création de l'animation", progress: 45 });
    let html;
    try {
      html = await generateComposition({ job, seconds, W, H, scenes, words, withWords, hasVoice, images: [...refImages, ...reviewImages], refNote, feedback, previousHtml });
    } catch (err) {
      if (!err.retryable || attempt === MAX_ATTEMPTS) throw err;
      console.error("[flash-motion] composition refusée, nouvelle tentative :", err.forbidden ?? err.refusal ?? err.message);
      if (err.forbidden) {
        feedback = `Ton code précédent contenait « ${err.forbidden} », interdit. Supprime-le : n'utilise que window.renderAt(t) et window.FM, sans horloge réelle ni animation CSS.`;
      } else {
        // Réponse qui n'est pas du HTML : souvent un refus lié à l'image. On l'écarte et on reste sur des formes.
        if (refImages.length) {
          console.error("[flash-motion] images de référence écartées pour la nouvelle tentative");
          refImages = [];
        }
        feedback = "Ta réponse précédente n'était pas une page HTML. Renvoie uniquement le code HTML complet. N'essaie pas de représenter une personne réelle : utilise des formes, des couleurs et des textes.";
      }
      reviewImages = [];
      continue;
    }

    // Contrôle automatique : textes présents, éléments dans le cadre
    await updateJob(job.id, { stage: "Contrôle de la vidéo", progress: 60 });
    let report = { problems: [], frames: [] };
    try {
      report = await inspectComposition({ html, seconds, width: W, height: H, requiredTexts });
    } catch (err) {
      console.error("[flash-motion] contrôle impossible :", err.message);
    }
    if (report.problems.length && attempt < MAX_ATTEMPTS) {
      console.error("[flash-motion] contrôle, à corriger :", report.problems.join(" ; "));
      feedback = "Problèmes relevés dans ta page précédente :\n- " + report.problems.join("\n- ") +
        "\nCorrige-les tous, en gardant le même storyboard. Les images jointes montrent le rendu actuel.";
      previousHtml = html;
      reviewImages = report.frames;
      continue;
    }
    if (report.problems.length) console.error("[flash-motion] problèmes restants, rendu quand même :", report.problems.join(" ; "));

    // Revue visuelle : le modèle regarde le rendu et décide s'il faut corriger
    if (!report.problems.length && attempt < MAX_ATTEMPTS && report.frames.length) {
      await updateJob(job.id, { stage: "Revue visuelle", progress: 65 });
      let verdict = { ok: true, issues: [] };
      try {
        verdict = await reviewVisually({ job, scenes, frames: report.frames });
      } catch (err) {
        console.error("[flash-motion] revue impossible :", err.message);
      }
      if (!verdict.ok && verdict.issues.length) {
        console.error("[flash-motion] revue, à corriger :", verdict.issues.join(" ; "));
        feedback = "Revue visuelle de ton rendu. Corrige ces points, sans changer le storyboard :\n- " + verdict.issues.join("\n- ");
        previousHtml = html;
        reviewImages = report.frames;
        continue;
      }
    }
    reviewImages = [];
    previousHtml = null;

    await updateJob(job.id, { stage: "Rendu de la vidéo", progress: 70 });
    try {
      rendered = await renderVideo({ html, seconds, audio, w: W, h: H });
      break;
    } catch (err) {
      if (attempt === MAX_ATTEMPTS || !String(err.message).includes("statique")) throw err;
      console.error("[flash-motion] composition statique, nouvelle tentative");
      feedback = "La composition précédente était statique. Ajoute un mouvement à chaque scène : zoom ou glissement avec FM.seg et un easing, et fondu d'entrée et de sortie.";
    }
  }
  if (!rendered) throw new Error("Composition impossible à générer après plusieurs tentatives");

  // 5. Effets sonores
  const bytes = await addSoundEffects(rendered, buildCues(scenes, seconds), hasVoice);

  // 6. Envoi et clôture
  await updateJob(job.id, { stage: "Envoi", progress: 92 });
  const videoPath = `${job.user_id}/${job.id}.mp4`;
  await uploadStorage(videoPath, bytes, "video/mp4");
  if (audio) await uploadStorage(`${job.user_id}/${job.id}.mp3`, audio, "audio/mpeg");
  await updateJob(job.id, { status: "ready", video_path: videoPath, html: null, stage: "Terminée", progress: 100 });
}

// ---------- Effets sonores (bibliothèque générée, worker/sounds/) ----------
const SFX = { whoosh: "whoosh.mp3", impact: "impact.mp3", clic: "clic.mp3", montee: "montee.mp3", ding: "ding.mp3" };

/** Impact au premier écran, whoosh à chaque transition, ding sur le dernier écran. */
function buildCues(scenes, total) {
  const cues = [];
  let t = 0;
  scenes.forEach((sc, i) => {
    const at = Math.max(0, Math.min(t, total - 0.5));
    if (i === 0) cues.push({ file: SFX.impact, at, vol: 0.7 });
    else if (i === scenes.length - 1 && scenes.length > 1) cues.push({ file: SFX.ding, at, vol: 0.7 });
    else cues.push({ file: SFX.whoosh, at, vol: 0.6 });
    t += Number(sc.seconds) || 0;
  });
  return cues.filter((c) => c.at < total);
}

/** Mélange les effets sonores dans la vidéo (sans réencoder l'image). */
async function addSoundEffects(videoBytes, cues, hasVoice) {
  const present = cues.map((c, k) => k).filter((k) => existsSync(join(here, "sounds", cues[k].file)));
  if (present.length < cues.length) {
    console.error(`[flash-motion] effets sonores manquants : ${cues.length - present.length} sur ${cues.length} (voir worker/sounds/)`);
  }
  if (!present.length) return videoBytes;
  const dir = await mkdtemp(join(tmpdir(), "sfx-"));
  const inPath = join(dir, "in.mp4");
  const outPath = join(dir, "out.mp4");
  await writeFile(inPath, videoBytes);
  const args = ["-y", "-loglevel", "error", "-i", inPath];
  present.forEach((k) => args.push("-i", join(here, "sounds", cues[k].file)));
  const parts = [];
  const labels = [];
  if (hasVoice) labels.push("[0:a]");
  present.forEach((k, idx) => {
    const ms = Math.round(cues[k].at * 1000);
    parts.push(`[${idx + 1}:a]adelay=${ms}|${ms},volume=${cues[k].vol}[s${idx}]`);
    labels.push(`[s${idx}]`);
  });
  parts.push(`${labels.join("")}amix=inputs=${labels.length}:normalize=0:dropout_transition=0[aout]`);
  args.push("-filter_complex", parts.join(";"), "-map", "0:v", "-map", "[aout]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", outPath);
  await exec("ffmpeg", args, { timeout: 5 * 60 * 1000 });
  return readFile(outPath);
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
