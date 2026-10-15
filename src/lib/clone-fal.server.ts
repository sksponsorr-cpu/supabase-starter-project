/**
 * Clonage vidéo via fal.ai (Kling 3.0 standard motion control).
 * Utilisé uniquement quand le moteur « fal » est choisi dans le bureau d'administrateur.
 */

const QUEUE = "https://queue.fal.run";
const MODEL = "fal-ai/kling-video/v3/standard/motion-control";

/** Lance le clonage sur fal.ai et renvoie l'identifiant de la requête. */
export async function submitCloneFal(input: {
  imageUrl: string;
  videoUrl: string;
  prompt: string;
  orientation: "image" | "video";
}): Promise<string> {
  const key = process.env["FAL_KEY"];
  if (!key) throw new Error("FAL_KEY manquante");
  const res = await fetch(`${QUEUE}/${MODEL}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: input.imageUrl,
      video_url: input.videoUrl,
      prompt: input.prompt || "",
      character_orientation: input.orientation,
      keep_original_sound: true,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { request_id?: string; detail?: unknown };
  if (!res.ok || !json.request_id) {
    console.error("[clone-fal] soumission refusée", res.status, JSON.stringify(json).slice(0, 400));
    throw new Error("Soumission fal.ai refusée");
  }
  return json.request_id;
}

type JobRow = { id: string; user_id: string; cost_charged: number; status?: string; result_url?: string | null };

/** Suit une tâche fal.ai : renvoie le résultat, ou rembourse en cas d'échec. */
export async function checkCloneFal(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  job: JobRow,
  requestId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  failAndRefund: (db: any, job: JobRow, reason: string) => Promise<unknown>,
) {
  const key = process.env["FAL_KEY"] ?? "";
  const headers = { Authorization: `Key ${key}` };
  try {
    const st = await fetch(`${QUEUE}/${MODEL}/requests/${requestId}/status`, { headers });
    const s = (await st.json().catch(() => ({}))) as { status?: string; queue_position?: number };

    if (s.status === "COMPLETED") {
      const r = await fetch(`${QUEUE}/${MODEL}/requests/${requestId}`, { headers });
      const out = (await r.json().catch(() => ({}))) as { video?: { url?: string } };
      const url = out.video?.url ?? null;
      if (!url) {
        await failAndRefund(db, job, "no-result");
        return { ok: true as const, status: "failed" as const, resultUrl: null, progress: 0, message: "La génération a échoué. Vos crédits ont été remboursés." };
      }
      // Une seule mise à jour, même si la page interroge plusieurs fois.
      await db
        .from("ai_jobs")
        .update({ status: "success", result_url: url, reconciled: true, updated_at: new Date().toISOString() })
        .eq("id", job.id)
        .neq("status", "success");
      return { ok: true as const, status: "success" as const, resultUrl: url, progress: 100 };
    }

    if (s.status === "FAILED") {
      await failAndRefund(db, job, "fal-failed");
      return { ok: true as const, status: "failed" as const, resultUrl: null, progress: 0, message: "La génération a échoué. Vos crédits ont été remboursés." };
    }

    return { ok: true as const, status: "processing" as const, resultUrl: null, progress: s.status === "IN_PROGRESS" ? 50 : 10 };
  } catch (error) {
    console.error("[clone-fal] suivi impossible", error);
    return { ok: true as const, status: "processing" as const, resultUrl: null, progress: 0 };
  }
}
