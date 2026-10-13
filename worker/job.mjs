#!/usr/bin/env node
/**
 * Worker Flash Motion AI : prend un job en file, rend la vidéo, la range dans Supabase.
 * Variables : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[flash-motion] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante");
  process.exit(1);
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  // Node sans WebSocket natif : on fournit le module ws à la bibliothèque Supabase.
  realtime: { transport: WebSocket },
});

async function claimNext() {
  const { data, error } = await db
    .from("flash_motion_jobs").select("*").eq("status", "queued")
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error) throw new Error(`Lecture de la file impossible : ${error.message}`);
  if (!data) return null;
  // Réservation : ne passe en "rendering" que si le job est encore en file.
  const { data: claimed } = await db
    .from("flash_motion_jobs").update({ status: "rendering", updated_at: new Date().toISOString() })
    .eq("id", data.id).eq("status", "queued").select().maybeSingle();
  return claimed ?? null;
}

async function processJob(job) {
  const dir = await mkdtemp(join(tmpdir(), "fm-"));
  const htmlPath = join(dir, "scene.html");
  const videoPath = join(dir, "video.mp4");
  await writeFile(htmlPath, job.html, "utf8");

  let audioLocal = null;
  if (job.with_voiceover && job.audio_path) {
    const { data, error } = await db.storage.from("flash-motion").download(job.audio_path);
    if (error) throw new Error(`Voix off introuvable : ${error.message}`);
    audioLocal = join(dir, "voix.mp3");
    await writeFile(audioLocal, Buffer.from(await data.arrayBuffer()));
  }

  const args = [join(here, "render.mjs"), "--html", htmlPath, "--out", videoPath,
    "--duration", String(job.seconds), "--width", "1080", "--height", "1920", "--fps", "30"];
  if (audioLocal) args.push("--audio", audioLocal);
  await exec("node", args, { timeout: 15 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 });

  const bytes = await readFile(videoPath);
  const storagePath = `${job.user_id}/${job.id}.mp4`;
  const up = await db.storage.from("flash-motion").upload(storagePath, bytes, {
    contentType: "video/mp4", upsert: true,
  });
  if (up.error) throw new Error(`Envoi de la vidéo échoué : ${up.error.message}`);

  await db.from("flash_motion_jobs").update({
    status: "ready", video_path: storagePath, html: null, updated_at: new Date().toISOString(),
  }).eq("id", job.id);
}

async function fail(job, err) {
  console.error("[flash-motion] échec", job.id, err.message);
  await db.from("flash_motion_jobs").update({
    status: "failed", error: String(err.message).slice(0, 500), updated_at: new Date().toISOString(),
  }).eq("id", job.id);
}

console.log("[flash-motion] worker démarré, surveillance de la file");

// La boucle ne s'arrête jamais sur une erreur : elle journalise et continue.
while (true) {
  try {
    const job = await claimNext();
    if (job) {
      console.log("[flash-motion] job pris", job.id);
      try {
        await processJob(job);
        console.log("[flash-motion] prêt", job.id);
      } catch (err) {
        await fail(job, err);
      }
    } else {
      await new Promise((r) => setTimeout(r, 3000));
    }
  } catch (err) {
    console.error("[flash-motion] erreur de boucle", err.message);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
