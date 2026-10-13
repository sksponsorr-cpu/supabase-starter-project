#!/usr/bin/env node
/**
 * Worker Flash Motion AI, sans bibliothèque Supabase : appels HTTP directs.
 * Variables : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));

const URL_BASE = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!URL_BASE || !KEY) {
  console.error("[flash-motion] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante");
  process.exit(1);
}

const authHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const jsonHeaders = { ...authHeaders, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rest(path, init = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, init);
  if (!res.ok) throw new Error(`REST ${res.status} : ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function nextQueued() {
  const rows = await rest(
    "flash_motion_jobs?status=eq.queued&order=created_at.asc&limit=1&select=*",
    { headers: authHeaders },
  );
  return rows?.[0] ?? null;
}

async function claim(id) {
  // Ne passe en "rendering" que si le job est encore en file.
  const rows = await rest(`flash_motion_jobs?id=eq.${id}&status=eq.queued&select=*`, {
    method: "PATCH",
    headers: { ...jsonHeaders, Prefer: "return=representation" },
    body: JSON.stringify({ status: "rendering", updated_at: new Date().toISOString() }),
  });
  return rows?.[0] ?? null;
}

async function updateJob(id, fields) {
  await rest(`flash_motion_jobs?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...jsonHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  });
}

async function downloadAudio(path) {
  const res = await fetch(`${URL_BASE}/storage/v1/object/flash-motion/${path}`, { headers: authHeaders });
  if (!res.ok) throw new Error(`Voix off introuvable (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadVideo(path, bytes) {
  const res = await fetch(`${URL_BASE}/storage/v1/object/flash-motion/${path}`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "video/mp4", "x-upsert": "true" },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Envoi de la vidéo échoué (${res.status}) : ${await res.text()}`);
}

async function processJob(job) {
  const dir = await mkdtemp(join(tmpdir(), "fm-"));
  const htmlPath = join(dir, "scene.html");
  const videoPath = join(dir, "video.mp4");
  await writeFile(htmlPath, job.html, "utf8");

  let audioLocal = null;
  if (job.with_voiceover && job.audio_path) {
    audioLocal = join(dir, "voix.mp3");
    await writeFile(audioLocal, await downloadAudio(job.audio_path));
  }

  const args = [join(here, "render.mjs"), "--html", htmlPath, "--out", videoPath,
    "--duration", String(job.seconds), "--width", "1080", "--height", "1920", "--fps", "30"];
  if (audioLocal) args.push("--audio", audioLocal);
  await exec("node", args, { timeout: 15 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 });

  const storagePath = `${job.user_id}/${job.id}.mp4`;
  await uploadVideo(storagePath, await readFile(videoPath));
  await updateJob(job.id, { status: "ready", video_path: storagePath, html: null });
}

console.log("[flash-motion] worker démarré, surveillance de la file");

// La boucle ne s'arrête jamais : chaque erreur est journalisée puis on continue.
while (true) {
  try {
    const next = await nextQueued();
    if (!next) {
      await sleep(3000);
      continue;
    }
    const job = await claim(next.id);
    if (!job) continue; // déjà pris ailleurs
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
