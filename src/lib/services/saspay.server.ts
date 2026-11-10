/**
 * SasPay — paiement direct (softpay) et vérification des webhooks. Serveur uniquement.
 * SASPAY_API_KEY et SASPAY_WEBHOOK_SECRET ne doivent jamais être exposées au navigateur.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { resolveSaspayNetwork } from "@/lib/services/saspay-networks.server";

const BASE_URL = "https://api.saspay.me/api/v1";
const TOLERANCE_SECONDS = 300;

export type SaspayCollectInput = {
  amount: number;
  currency: string;
  countryCode: string;
  operatorLabel: string;
  description: string;
  name: string;
  email: string;
  /** Numéro international, chiffres seuls (ex. 243808782440). */
  phone: string;
};

export type SaspayCollectResult =
  | { ok: true; providerId: string | null; reference: string | null; raw: Record<string, unknown> }
  | { ok: false; message: string };

const DIAL: Record<string, string> = { BJ: "229", CD: "243", ML: "223" };

export function isSaspayConfigured(): boolean {
  return Boolean(process.env["SASPAY_API_KEY"]);
}

/** POST /payments/softpay/ : le client valide sur son téléphone, sans quitter le site. */
export async function createSaspayPayment(input: SaspayCollectInput): Promise<SaspayCollectResult> {
  const apiKey = process.env["SASPAY_API_KEY"];
  if (!apiKey) return { ok: false, message: "Paiement mobile indisponible : clé SasPay non configurée." };

  const network = resolveSaspayNetwork(input.countryCode, input.operatorLabel);
  if (!network) {
    return {
      ok: false,
      message: `Aucun réseau SasPay pour ${input.countryCode} / ${input.operatorLabel}. Choisis un autre moyen de paiement.`,
    };
  }

  const digits = input.phone.replace(/\D/g, "");
  const code = DIAL[input.countryCode.toUpperCase()] ?? "";
  const phone = code && !digits.startsWith(code) ? `${code}${digits}` : digits;

  const parts = input.name.trim().split(/\s+/);
  const body = {
    amount: input.amount.toFixed(2),
    currency: input.currency,
    country: input.countryCode.toUpperCase(),
    network,
    description: input.description,
    customer: {
      email: input.email,
      first_name: parts[0] || "Client",
      last_name: parts.slice(1).join(" ") || "Sam flash",
      phone: `+${phone}`,
    },
  };

  const paths = ["/payments/softpay/", "/payments/softpay/initialize/"];
  let res!: Response;
  try {
    for (const path of paths) {
      res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
      if (res.status !== 404) break;
    }
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    return {
      ok: false,
      message: timeout ? "SasPay met trop de temps à répondre." : "Impossible de contacter SasPay.",
    };
  }

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = {};
  }

  if (!res.ok) {
    const envelope = json["error"] && typeof json["error"] === "object" ? (json["error"] as Record<string, unknown>) : null;
    const businessMessage = envelope && typeof envelope["message"] === "string" ? envelope["message"] : null;
    const fieldErrors = Object.entries(json)
      .filter(([k, v]) => k !== "error" && k !== "success" && k !== "code" && Array.isArray(v))
      .map(([k, v]) => `${k} : ${(v as unknown[]).join(", ")}`);
    const detail = [businessMessage, fieldErrors.length ? fieldErrors.join(" ; ") : null].filter(Boolean).join(" ");
    console.error("[saspay] softpay", res.status, text.slice(0, 1000));
    return { ok: false, message: `SasPay ${res.status} : ${detail || "requête refusée"}` };
  }

  const data =
    json["data"] && typeof json["data"] === "object" && !Array.isArray(json["data"])
      ? (json["data"] as Record<string, unknown>)
      : json;
  const providerId = data["id"] ?? data["payment_id"] ?? null;
  const reference = data["reference"] ?? null;
  return {
    ok: true,
    providerId: providerId != null ? String(providerId) : null,
    reference: reference != null ? String(reference) : null,
    raw: json,
  };
}

/** Vérifie X-Webhook-Signature sur le corps brut, avec contrôle d'âge (5 minutes). */
export function verifySaspaySignature(rawBody: string, signature: string, timestamp: string, secret: string): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) return false;
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type SaspayStatusResult =
  | { ok: true; outcome: "payee" | "echouee" | null; status: string; raw: Record<string, unknown> }
  | { ok: false; message: string };

/**
 * GET /checkout-sessions/{id}/status/ : statut vérifié auprès de SasPay.
 * Sert de filet de sécurité quand le webhook n'est pas reçu.
 */
export async function fetchSaspayStatus(providerId: string): Promise<SaspayStatusResult> {
  const apiKey = process.env["SASPAY_API_KEY"];
  if (!apiKey) return { ok: false, message: "Clé SasPay non configurée." };

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/checkout-sessions/${encodeURIComponent(providerId)}/status/`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return { ok: false, message: "Impossible de contacter SasPay." };
  }

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = {};
  }
  if (!res.ok) return { ok: false, message: `SasPay ${res.status} : statut indisponible.` };

  const status = String(json["status"] ?? "").toUpperCase();
  const transactionStatus = String(json["transaction_status"] ?? "").toUpperCase();

  let outcome: "payee" | "echouee" | null = null;
  if (status === "PAID" || transactionStatus === "SUCCESS") outcome = "payee";
  else if (["FAILED", "CANCELLED", "CANCELED", "EXPIRED", "DECLINED"].includes(transactionStatus) ||
           ["FAILED", "CANCELLED", "CANCELED", "EXPIRED"].includes(status)) outcome = "echouee";

  return { ok: true, outcome, status: status || transactionStatus, raw: json };
}
