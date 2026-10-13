/**
 * Voix off ElevenLabs via KIE. Serveur uniquement (KIE_API_KEY).
 * Documentation : elevenlabs/text-to-speech-multilingual-v2 (createTask puis recordInfo).
 */
import { FLASH_MOTION } from "./config";

const BASE = "https://api.kie.ai/api/v1/jobs";

export type WordTiming = { word: string; start: number; end: number };

export function voiceAvailable(): boolean {
  return Boolean(process.env.KIE_API_KEY);
}

function key(): string {
  const k = process.env.KIE_API_KEY ?? "";
  if (!k) throw new Error("Voix off indisponible : KIE_API_KEY manquante");
  return k;
}

/** Lance la synthèse, attend le résultat, renvoie l'audio, sa durée et les mots si KIE les fournit. */
export async function synthesizeVoiceover(text: string): Promise<{
  audio: Uint8Array;
  duration: number;
  words: WordTiming[] | null;
}> {
  const create = await fetch(`${BASE}/createTask`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: FLASH_MOTION.ttsModel,
      input: {
        text: text.slice(0, 4000),
        voice: FLASH_MOTION.ttsVoice,
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        speed: 1,
        timestamps: true,
        previous_text: "",
        next_text: "",
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
      const parsed = JSON.parse(json.data?.resultJson ?? "{}") as {
        resultUrls?: string[];
        resultObject?: { words?: WordTiming[] } | null;
      };
      const url = parsed.resultUrls?.[0];
      if (!url) throw new Error("Synthèse vocale : aucun fichier audio renvoyé");
      const file = await fetch(url);
      if (!file.ok) throw new Error("Téléchargement de la voix off impossible");
      const audio = new Uint8Array(await file.arrayBuffer());
      const words = parsed.resultObject?.words?.length ? parsed.resultObject.words : null;
      // Estimation de secours : environ 2,5 mots par seconde
      const count = text.trim().split(/\s+/).length;
      return { audio, duration: Math.max(1, count / 2.5), words };
    }
  }
  throw new Error("Synthèse vocale : délai dépassé");
}

/** Répartit les mots sur la durée de la voix (estimation de secours). */
export function estimateWordTimings(text: string, duration: number): WordTiming[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const step = duration / words.length;
  return words.map((word, i) => ({ word, start: i * step, end: (i + 1) * step }));
}
