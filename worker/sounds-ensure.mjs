/**
 * Crée avec fal.ai les effets sonores absents de worker/sounds/, au démarrage du worker.
 * Coût : environ 0,002 $ par seconde générée, soit quelques centimes pour les cinq effets.
 * Les fichiers existants ne sont jamais regénérés.
 */
import { fal } from "@fal-ai/client";
import { existsSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "sounds");

const LIBRARY = {
  whoosh: "Whoosh cinématique court, transition de motion design haut de gamme, sans voix",
  impact: "Impact sourd et net de titre, basse profonde, motion design premium, sans voix",
  clic: "Clic sec et propre de bouton d'interface, très court, sans voix",
  montee: "Montée de tension électronique courte, qui conduit vers un titre, sans voix",
  ding: "Petit ding brillant de révélation de logo, élégant, sans voix",
};

export async function ensureSounds() {
  const missing = Object.keys(LIBRARY).filter((name) => !existsSync(join(dir, `${name}.mp3`)));
  if (missing.length === 0) return;
  if (!process.env.FAL_KEY) {
    console.error("[flash-motion] effets sonores absents et FAL_KEY manquante : aucun son ne sera ajouté");
    return;
  }
  fal.config({ credentials: process.env.FAL_KEY });
  await mkdir(dir, { recursive: true });
  for (const name of missing) {
    try {
      const res = await fal.subscribe("fal-ai/elevenlabs/sound-effects/v2", {
        input: { text: LIBRARY[name], duration_seconds: 1.5, prompt_influence: 0.6, output_format: "mp3_44100_128" },
      });
      const buf = Buffer.from(await (await fetch(res.data.audio.url)).arrayBuffer());
      await writeFile(join(dir, `${name}.mp3`), buf);
      console.log("[flash-motion] effet sonore créé :", name);
    } catch (err) {
      console.error("[flash-motion] effet sonore impossible :", name, err.message);
    }
  }
}
