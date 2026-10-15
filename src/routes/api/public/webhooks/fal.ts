import { createFileRoute } from "@tanstack/react-router";
import { handleStepResult } from "@/lib/long-jobs.server";
import { timingSafeEqual } from "crypto";

/** Vérifie le secret transmis dans l'URL du webhook (comparaison à temps constant). */
function secretValid(request: Request): boolean {
  const expected = process.env["FAL_WEBHOOK_SECRET"];
  const given = new URL(request.url).searchParams.get("s") ?? "";
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Reçoit les notifications de fal.ai quand une étape est terminée.
 * À sécuriser avant mise en production : vérifier la signature fal.ai (en-têtes X-Fal-*).
 */
type FalWebhookBody = {
  request_id?: string;
  status?: string;
  payload?: { video?: { url?: string } };
  error?: string;
};

export const Route = createFileRoute("/api/public/webhooks/fal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!secretValid(request)) return new Response("unauthorized", { status: 401 });
        const body = (await request.json().catch(() => null)) as FalWebhookBody | null;
        if (!body?.request_id) return new Response("bad request", { status: 400 });

        const ok = body.status === "OK" && !!body.payload?.video?.url;
        // Traitement en tâche de fond : on répond vite à fal.ai.
        handleStepResult(body.request_id, ok ? body.payload!.video!.url! : null, body.error).catch(() => {});
        return new Response("ok", { status: 200 });
      },
    },
  },
});
