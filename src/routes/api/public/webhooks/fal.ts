import { createFileRoute } from "@tanstack/react-router";
import { handleStepResult } from "@/lib/long-jobs.server";

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
