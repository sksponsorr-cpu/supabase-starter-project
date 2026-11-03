import { createFileRoute } from "@tanstack/react-router";
import { handleTaskCallback } from "@/lib/long-jobs.server";
import { timingSafeEqual } from "crypto";

/** Vérifie le secret transmis dans l'URL du callback (comparaison à temps constant). */
function secretValid(request: Request): boolean {
  const expected = process.env["KIE_WEBHOOK_SECRET"];
  const given = new URL(request.url).searchParams.get("s") ?? "";
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Callback Kie.ai (videoTaskCompleted). Le corps n'est utilisé que pour récupérer l'identifiant de tâche :
 * l'état réel est relu auprès de Kie.ai avant d'enchaîner la suite.
 */
export const Route = createFileRoute("/api/public/webhooks/kie")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!secretValid(request)) return new Response("unauthorized", { status: 401 });
        const body = (await request.json().catch(() => null)) as
          | { taskId?: string; data?: { taskId?: string } }
          | null;
        const taskId = body?.data?.taskId ?? body?.taskId;
        if (!taskId) return new Response("bad request", { status: 400 });
        // Traitement attendu avant la réponse : sur Vercel, une tâche de fond est coupée dès la réponse.
        try {
          const { handleFlashEditCallback } = await import("@/lib/flash-edit.server");
          if (!(await handleFlashEditCallback(taskId))) await handleTaskCallback(taskId);
        } catch (e) {
          console.error("[kie webhook]", taskId, e);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
