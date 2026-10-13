#!/usr/bin/env node
/**
 * Moteur de rendu Flash Motion AI.
 * Ouvre la composition HTML dans Chromium (sans écran), appelle window.renderAt(t)
 * pour chaque image, envoie les captures à ffmpeg et ajoute la voix off.
 *
 * Usage :
 *   node render.mjs --html scene.html --audio voix.mp3 --out video.mp4 \
 *        --duration 20 --width 1080 --height 1920 --fps 30
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const htmlPath = args.html;
const audioPath = args.audio ?? null;
const outPath = args.out ?? "video.mp4";
const duration = Number(args.duration ?? 15);
const width = Number(args.width ?? 1080);
const height = Number(args.height ?? 1920);
const fps = Number(args.fps ?? 30);

if (!htmlPath) throw new Error("--html est obligatoire");
if (audioPath && !existsSync(audioPath)) throw new Error(`Audio introuvable : ${audioPath}`);

const runtime = await readFile(join(here, "runtime.js"), "utf8");
const composition = await readFile(htmlPath, "utf8");
// Le runtime est injecté juste avant la composition.
const html = composition.replace("<head>", `<head><script>${runtime}</script>`);
if (!html.includes("window.FM")) {
  throw new Error("Impossible d'injecter le runtime (balise <head> absente)");
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const hasRender = await page.evaluate(() => typeof window.renderAt === "function");
if (!hasRender) throw new Error("La composition doit définir window.renderAt(t)");

const ffArgs = [
  "-y", "-loglevel", "error",
  "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(fps), "-i", "-",
];
if (audioPath) ffArgs.push("-i", audioPath);
ffArgs.push(
  "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
);
if (audioPath) ffArgs.push("-c:a", "aac", "-b:a", "192k", "-shortest");
ffArgs.push(outPath);

ffArgs.splice(ffArgs.indexOf(outPath), 0, "-threads", "2");
const ff = spawn("ffmpeg", ffArgs, { stdio: ["pipe", "inherit", "pipe"] });
// On garde la fin des messages de ffmpeg pour comprendre une panne.
let ffErr = "";
ff.stderr.on("data", (chunk) => {
  ffErr = (ffErr + chunk.toString()).slice(-2000);
});
// Si ffmpeg s'arrête, on ne plante pas : on remonte une erreur lisible.
ff.stdin.on("error", () => {});
const ffDone = new Promise((resolve, reject) => {
  ff.on("error", (err) => reject(new Error(`ffmpeg introuvable : ${err.message}`)));
  ff.on("close", (code, signal) => {
    if (code === 0) return resolve();
    const cause = signal ? `arrêté par le système (${signal}, souvent manque de mémoire)` : `code ${code}`;
    reject(new Error(`ffmpeg a échoué : ${cause}. ${ffErr.slice(-400)}`));
  });
});

const totalFrames = Math.round(duration * fps);
for (let i = 0; i < totalFrames; i++) {
  const t = i / fps;
  await page.evaluate(time => window.renderAt(time), t);
  const png = await page.screenshot({ type: "jpeg", quality: 92 });
  if (ff.exitCode !== null || ff.signalCode !== null) break; // ffmpeg s'est arrêté : inutile de continuer
  if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once("drain", r));
}
ff.stdin.end();
await ffDone;
await browser.close();
console.log(JSON.stringify({ ok: true, out: outPath, frames: totalFrames }));
