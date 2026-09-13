import { createFileRoute } from "@tanstack/react-router";
import { handleChariowWebhook } from "@/lib/payments/chariow.server";

export const Route = createFileRoute("/api/public/webhooks/chariow")({
  server: {
    handlers: {
      POST: async ({ request }) => handleChariowWebhook(request),
      GET: async ({ request }) => handleChariowWebhook(request),
    },
  },
});
