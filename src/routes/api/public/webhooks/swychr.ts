import { createFileRoute } from "@tanstack/react-router";
import { handleSwychrCallback } from "@/lib/payments/webhook.server";

export const Route = createFileRoute("/api/public/webhooks/swychr")({
  server: {
    handlers: {
      POST: async ({ request }) => handleSwychrCallback(request),
      GET: async ({ request }) => handleSwychrCallback(request),
    },
  },
});
