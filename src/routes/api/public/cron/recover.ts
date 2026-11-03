import { createFileRoute } from "@tanstack/react-router";

/**
 * Récupération planifiée (appelée par le planificateur toutes les 5 minutes).
 * Protégée par CRON_SECRET : Vercel envoie « Authorization: Bearer <CRON_SECRET> ».
 */
export const Route = createFileRoute("/api/public/cron/recover")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env["CRON_SECRET"];
        const auth = request.headers.get("authorization") ?? "";
        if (!expected || auth !== `Bearer ${expected}`) return new Response("unauthorized", { status: 401 });

        const { runGenerationRecovery } = await import("@/lib/services/generation.server");
        const { recoverStuckLongJobs } = await import("@/lib/long-jobs.server");
        try {
          const generations = await runGenerationRecovery();
          const videos = await recoverStuckLongJobs();
          const { recoverStuckFlashEdits } = await import("@/lib/flash-edit.server");
          const flashEdits = await recoverStuckFlashEdits();
          return Response.json({ generations, videos, flashEdits });
        } catch (e) {
          console.error("[cron recover]", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
