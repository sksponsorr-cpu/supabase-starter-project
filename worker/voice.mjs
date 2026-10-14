import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fal } from "@fal-ai/client";

const exec = promisify(execFile);

/** Durée réelle d'un fichier audio, en secondes (ffprobe). */
export async function audioDuration(buffer) {
  const dir = await mkdtemp(join(tmpdir(), "dur-"));
  const path = join(dir, "voix.mp3");
  await writeFile(path, buffer);
  const { stdout } = await exec("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1", path,
  ]);
  const d = parseFloat(stdout.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error("Durée audio illisible");
  return d;
}

/**
 * Timings réels des mots, par transcription Whisper sur fal.ai.
 * Renvoie null si FAL_KEY est absente ou si aucun mot n'est reconnu.
 */
export async function transcribeWords(buffer) {
  if (!process.env.FAL_KEY) return null;
  fal.config({ credentials: process.env.FAL_KEY });
  const blob = new Blob([buffer], { type: "audio/mpeg" });
  const audioUrl = await fal.storage.upload(blob);
  const result = await fal.subscribe("fal-ai/whisper", {
    input: { audio_url: audioUrl, task: "transcribe", language: "fr", chunk_level: "word" },
  });
  const chunks = result?.data?.chunks ?? [];
  const words = chunks
    .filter((c) => Array.isArray(c.timestamp) && c.text?.trim())
    .map((c) => ({ word: c.text.trim(), start: c.timestamp[0], end: c.timestamp[1] }));
  return words.length ? words : null;
}
