/**
 * Voix off ElevenLabs via KIE. Serveur uniquement (KIE_API_KEY).
 * Modèle de tâche asynchrone : createTask puis recordInfo, comme pour la vidéo dans le projet.
 *
 * Les timings des mots ne viennent pas de KIE : ils sont estimés en répartissant
 * les mots sur la durée de l'audio. C'est approximatif, mais suffisant pour des sous-titres.
 */
import { FLASH_MOTION } from "./config";

const BASE = "https://api.kie.ai/api/v1/jobs";

export type WordTiming = { word: string; start: number; end: number };

export function voiceAvailable(): boolean {
  return Boolean(process.env.KIE_API_KEY) && Boolean(FLASH_MOTION.ttsVoiceId);
}

function key(): string {
  const k = process.env.KIE_API_KEY ?? "";
  if (!k) throw new Error("Voix off indisponible : KIE_API_KEY manquante");
  return k;
}

/** Lance la synthèse, attend le résultat, renvoie les octets MP3 et la durée estimée. */
export async function synthesizeVoiceover(text: string): Promise<{ audio: Uint8Array; duration: number }> {
  const create = await fetch(`${BASE}/createTask`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: FLASH_MOTION.ttsModel,
      input: {
        text: text.slice(0, 4000),
        voice_id: FLASH_MOTION.ttsVoiceId,
        language_code: "fr",
      },
    }),
  });
  const created = (await create.json()) as { code?: number; data?: { taskId?: string }; msg?: string };
  const taskId = created.data?.taskId;
  if (!create.ok || created.code !== 200 || !taskId) {
    throw new Error(`Synthèse vocale impossible : ${created.msg ?? create.status}`);
  }

  // Attente bornée : environ 2 minutes au maximum.
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const info = await fetch(`${BASE}/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${key()}` },
    });
    const json = (await info.json()) as {
      data?: { state?: string; resultJson?: string; failMsg?: string | null };
    };
    const state = json.data?.state;
    if (state === "fail") throw new Error(`Synthèse vocale échouée : ${json.data?.failMsg ?? "erreur"}`);
    if (state === "success") {
      const parsed = JSON.parse(json.data?.resultJson ?? "{}") as { resultUrls?: string[] };
      const url = parsed.resultUrls?.[0];
      if (!url) throw new Error("Synthèse vocale : aucun fichier audio renvoyé");
      const file = await fetch(url);
      if (!file.ok) throw new Error("Téléchargement de la voix off impossible");
      const audio = new Uint8Array(await file.arrayBuffer());
      // Estimation : environ 2,5 mots par seconde en français parlé
      const words = text.trim().split(/\s+/).length;
      return { audio, duration: Math.max(1, words / 2.5) };
    }
  }
  throw new Error("Synthèse vocale : délai dépassé");
}

/** Répartit les mots sur la durée de la voix (estimation). */
export function estimateWordTimings(text: string, duration: number): WordTiming[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const step = duration / words.length;
  return words.map((word, i) => ({ word, start: i * step, end: (i + 1) * step }));
}
