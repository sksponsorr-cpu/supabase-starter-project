/**
 * Réception des notifications Chariow (paiement par carte).
 * L'appel est authentifié par `CHARIOW_WEBHOOK_SECRET` : soit une signature
 * HMAC-SHA256 du corps brut, soit le secret transmis tel quel dans l'en-tête.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { applyOrderOutcome } from "@/lib/payments/webhook.server";

const PAID = ["paid", "success", "successful", "succeeded", "completed", "complete", "settled"];
const FAILED = ["failed", "failure", "cancelled", "canceled", "expired", "declined", "rejected"];

function signatureValid(rawBody: string, provided: string | null): boolean {
  const secret = process.env["CHARIOW_WEBHOOK_SECRET"];
  if (!secret) return false;
  if (!provided) return false;
  const candidate = provided.replace(/^sha256=/i, "").trim();
  if (candidate === secret) return true;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

export async function handleChariowWebhook(request: Request): Promise<Response> {
  const raw = request.method === "POST" ? await request.text() : "";
  const provided =
    request.headers.get("x-chariow-signature") ??
    request.headers.get("x-webhook-signature") ??
    request.headers.get("x-chariow-secret") ??
    new URL(request.url).searchParams.get("secret");

  if (!signatureValid(raw, provided)) {
    console.warn("[chariow] webhook rejeté : signature invalide");
    return new Response("Signature invalide", { status: 401 });
  }

  let body: Record<string, unknown> = {};
  if (raw) {
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return new Response("Payload invalide", { status: 400 });
    }
  }
  console.log("[chariow] webhook reçu", raw.slice(0, 1000));

  const data = (body["data"] as Record<string, unknown>) ?? body;
  const metadata = (data["metadata"] as Record<string, unknown>) ?? {};
  const transactionId =
    pick(metadata, ["transaction_id", "reference"]) ??
    pick(data, ["transaction_id", "reference", "order_reference"]);
  const sessionId = pick(data, ["id", "session_id", "checkout_id"]);
  const status = (
    pick(data, ["status", "payment_status", "state"]) ??
    pick(body, ["event", "type"]) ??
    ""
  ).toLowerCase();

  const outcome = PAID.some((s) => status.includes(s))
    ? ("payee" as const)
    : FAILED.some((s) => status.includes(s))
      ? ("echouee" as const)
      : null;
  if (!outcome) return new Response("ok");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let target = transactionId;
  if (!target && sessionId) {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("transaction_id")
      .eq("provider_session_id", sessionId)
      .maybeSingle();
    target = order?.transaction_id ?? null;
  }
  if (!target) {
    const email = pick(data, ["customer_email", "email"]) ?? pick(metadata, ["email"]);
    if (email) {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("transaction_id")
        .eq("customer_email", email)
        .eq("provider", "chariow")
        .eq("status", "en_attente")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      target = order?.transaction_id ?? null;
    }
  }
  if (!target) return new Response("Commande introuvable", { status: 404 });

  const result = await applyOrderOutcome(target, outcome, status, body);
  if (result === "introuvable") return new Response("Commande introuvable", { status: 404 });
  return new Response("ok");
}
