import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { kieCreditsToSamCredits } from "@/lib/ai-pricing";
import { DEFAULT_KIE_VOICE, KIE_VOICES } from "@/lib/kie-voices";

const KIE_BASE = "https://api.kie.ai/api/v1/jobs";
const VOICE_IDS = new Set(KIE_VOICES.map((v) => v.id));

/** 12 crédits KIE pour 1 000 caractères, converti au barème Sam Flash (minimum 1). */
export function voiceCostFor(chars: number): number {
  const kie = (chars / 1000) * 12;
  return Math.max(1, Math.ceil(kieCreditsToSamCredits(kie)));
}

/** Lance la génération de voix off et débite le solde créateur. Renvoie l'identifiant de tâche. */
export const startVoiceOff = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        text: z.string().trim().min(1).max(1500),
        voice: z.string().refine((v) => VOICE_IDS.has(v), "Voix inconnue").default(DEFAULT_KIE_VOICE),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const key = process.env.KIE_API_KEY;
    if (!key) return { ok: false as const, message: "Voix off indisponible pour le moment." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const cost = voiceCostFor(data.text.length);
    const { data: prof } = await db.from("profiles").select("credits_balance").eq("id", context.userId).maybeSingle();
    const balance = Number(prof?.credits_balance ?? 0);
    if (balance < cost) return { ok: false as const, message: `Crédits insuffisants : cette voix coûte ${cost} crédit(s), tu en as ${balance}.` };

    const res = await fetch(`${KIE_BASE}/createTask`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "elevenlabs/text-to-speech-multilingual-v2",
        input: {
          text: data.text,
          voice: data.voice,
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          speed: 1,
          timestamps: false,
          previous_text: "",
          next_text: "",
          language_code: "",
        },
      }),
    });
    const json = (await res.json().catch(() => null)) as { code?: number; data?: { taskId?: string } } | null;
    const taskId = json?.data?.taskId;
    if (!res.ok || json?.code !== 200 || !taskId) {
      return { ok: false as const, message: "La voix n'a pas pu démarrer. Tes crédits ne sont pas décomptés." };
    }
    await db.from("profiles").update({ credits_balance: balance - cost }).eq("id", context.userId);
    return { ok: true as const, taskId, cost };
  });

/** Vérifie l'avancement d'une voix off. Renvoie l'URL audio quand elle est prête. */
export const checkVoiceOff = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ taskId: z.string().min(1).max(200) }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const key = process.env.KIE_API_KEY;
    if (!key) return { state: "fail" as const, url: null as string | null };
    const res = await fetch(`${KIE_BASE}/recordInfo?taskId=${encodeURIComponent(data.taskId)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const json = (await res.json().catch(() => null)) as {
      data?: { state?: string; resultJson?: string | null };
    } | null;
    const state = json?.data?.state ?? "waiting";
    if (state === "success") {
      let url: string | null = null;
      try {
        const parsed = JSON.parse(json?.data?.resultJson ?? "{}") as { resultUrls?: string[] };
        url = parsed.resultUrls?.[0] ?? null;
      } catch {
        url = null;
      }
      return { state: "success" as const, url };
    }
    if (state === "fail") return { state: "fail" as const, url: null };
    return { state: "waiting" as const, url: null };
  });
