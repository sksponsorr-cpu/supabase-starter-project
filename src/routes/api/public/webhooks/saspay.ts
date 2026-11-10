import { createFileRoute } from "@tanstack/react-router";
import { applyOrderOutcome } from "@/lib/payments/webhook.server";
import { verifySaspaySignature } from "@/lib/services/saspay.server";

// Événements SasPay -> résultat de commande.
const OUTCOME_BY_EVENT: Record<string, "payee" | "echouee"> = {
  "transaction.success": "payee",
  "transaction.failed": "echouee",
  "transaction.cancelled": "echouee",
};

async function handleSaspayWebhook(request: Request): Promise<Response> {
  const secret = process.env["SASPAY_WEBHOOK_SECRET"];
  if (!secret) return new Response("Secret webhook SasPay non configuré.", { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? "";
  const timestamp = request.headers.get("x-webhook-timestamp") ?? "";
  if (!verifySaspaySignature(rawBody, signature, timestamp, secret)) {
    return new Response("Signature invalide ou expirée.", { status: 401 });
  }

  let payload: { event?: string; data?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return new Response("JSON invalide.", { status: 400 });
  }

  const event = request.headers.get("x-webhook-event") ?? payload.event ?? "";
  const outcome = OUTCOME_BY_EVENT[event];
  if (!outcome) return Response.json({ received: true, ignored: true });

  const data = payload.data ?? {};
  const providerIds = [data["id"], data["reference"]].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  if (providerIds.length === 0) return new Response("Identifiant manquant.", { status: 400 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("transaction_id")
    .eq("provider", "saspay")
    .in("provider_transaction_id", providerIds)
    .maybeSingle();

  if (!order) return new Response("Transaction inconnue.", { status: 404 });

  const message = typeof data["message"] === "string" ? data["message"] : event;
  const result = await applyOrderOutcome(order.transaction_id, outcome, message, payload as Record<string, unknown>);
  return Response.json({ received: true, result });
}

export const Route = createFileRoute("/api/public/webhooks/saspay")({
  server: {
    handlers: {
      POST: async ({ request }) => handleSaspayWebhook(request),
    },
  },
});
