import { fal } from "@fal-ai/client";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
fal.config({ credentials: process.env.FAL_KEY });

const LIBRARY = {
  whoosh: "Whoosh cinématique court, transition de motion design haut de gamme, sans voix",
  impact: "Impact sourd et net de titre, basse profonde, motion design premium, sans voix",
  clic: "Clic sec et propre de bouton d'interface, très court, sans voix",
  montee: "Montée de tension électronique courte, qui conduit vers un titre, sans voix",
  ding: "Petit ding brillant de révélation de logo, élégant, sans voix",
};

for (const [name, text] of Object.entries(LIBRARY)) {
  const res = await fal.subscribe("fal-ai/elevenlabs/sound-effects/v2", {
    input: { text, duration_seconds: 1.5, prompt_influence: 0.6, output_format: "mp3_44100_128" },
  });
  const buf = Buffer.from(await (await fetch(res.data.audio.url)).arrayBuffer());
  await writeFile(join(here, `${name}.mp3`), buf);
  console.log("ok", name);
}
