/**
 * Pipeline Flash Motion AI (tout via KIE : GPT, Claude et ElevenLabs) :
 *  1. Un modèle léger écrit le script (voix off + scènes)
 *  2. La voix off ElevenLabs est générée via KIE si demandée
 *  3. Les mots sont répartis sur la durée de la voix (estimation)
 *  4. Le modèle choisi par l'utilisateur écrit la composition HTML
 *  5. La composition part dans la file de rendu (supabase/flash_motion.sql)
 */
import { FLASH_MOTION, resolveCodeModel } from "./config";
import { CODE_SYSTEM, SCRIPT_SYSTEM } from "./prompt";
import { askModel } from "./llm.server";
import { synthesizeVoiceover, estimateWordTimings, voiceAvailable, type WordTiming } from "./voice.server";

export type MotionBrief = {
  idea: string;
  seconds: number;
  withVoiceover: boolean;
  codeModelId?: string | null;
};

function stripFences(s: string): string {
  return s.replace(/^```(?:html|json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

export async function buildMotionVideo(brief: MotionBrief) {
  const seconds = Math.min(
    Math.max(Math.round(brief.seconds), FLASH_MOTION.minDurationSeconds),
    FLASH_MOTION.maxDurationSeconds,
  );
  const codeModel = resolveCodeModel(brief.codeModelId);
  const withVoiceover = brief.withVoiceover && voiceAvailable();

  // 1. Script
  const scriptRaw = stripFences(
    await askModel({
      provider: "claude",
      model: FLASH_MOTION.scriptModel,
      system: SCRIPT_SYSTEM,
      user: `Idée : ${brief.idea}\nDurée : ${seconds} secondes`,
      maxTokens: 1500,
    }),
  );
  const script = JSON.parse(scriptRaw) as { voiceover: string; scenes: { text: string; seconds: number }[] };

  // 2 et 3. Voix off et timings
  let audio: Uint8Array | null = null;
  let words: WordTiming[] = [];
  if (withVoiceover) {
    const voice = await synthesizeVoiceover(script.voiceover);
    audio = voice.audio;
    words = estimateWordTimings(script.voiceover, voice.duration);
  }

  // 4. Composition HTML, écrite par le modèle choisi
  const userMsg = [
    `Idée : ${brief.idea}`,
    `Durée totale : ${seconds} secondes`,
    `Format : ${FLASH_MOTION.width} x ${FLASH_MOTION.height} pixels`,
    `Scènes proposées : ${JSON.stringify(script.scenes)}`,
    withVoiceover
      ? `Voix off : ${script.voiceover}\nTimings des mots (secondes) : ${JSON.stringify(words)}\nDéclare ces mots dans une variable WORDS et utilise FM.wordsVisible(WORDS, t).`
      : "Pas de voix off : ne rien synchroniser avec une voix.",
  ].join("\n");

  const html = stripFences(
    await askModel({
      provider: codeModel.provider,
      model: codeModel.id,
      system: CODE_SYSTEM,
      user: userMsg,
      maxTokens: 16000,
    }),
  );

  if (!/<!doctype|<html/i.test(html) || !html.includes("<head>") || !html.includes("renderAt")) {
    throw new Error("La composition générée n'est pas valide (contrat non respecté)");
  }
  if (/requestAnimationFrame|setTimeout|setInterval|Math\.random|<script[^>]+src=/i.test(html)) {
    throw new Error("La composition utilise un élément interdit (horloge réelle ou ressource externe)");
  }

  return { html, seconds, audio, words, script, codeModel: codeModel.id, withVoiceover };
}
