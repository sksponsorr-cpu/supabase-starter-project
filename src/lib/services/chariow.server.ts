/**
 * Chariow — paiements par carte bancaire (EUR/USD). Serveur uniquement.
 *
 * Deux modes sont pris en charge :
 *  1. Liens de paiement Chariow (recommandé) : le secret `CHARIOW_CHECKOUT_URLS`
 *     contient un JSON associant chaque offre à son lien de commande Chariow.
 *     Les métadonnées (commande, utilisateur, e-mail, formule) sont ajoutées en
 *     paramètres d'URL afin d'être renvoyées dans le webhook.
 *  2. API Chariow : si `CHARIOW_API_KEY` (ou `VITE_CHARIOW_API_KEY`) est définie,
 *     une session de paiement est créée via l'API et son URL est utilisée.
 */

export type CheckoutSession = {
  url: string;
  sessionId: string | null;
};

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function apiKey(): string | null {
  return process.env["CHARIOW_API_KEY"] ?? process.env["VITE_CHARIOW_API_KEY"] ?? null;
}

function checkoutUrls(): Record<string, string> {
  const raw = process.env["CHARIOW_CHECKOUT_URLS"];
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.startsWith("http")) out[key.toLowerCase()] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function isChariowConfigured(): boolean {
  return Boolean(apiKey()) || Object.keys(checkoutUrls()).length > 0;
}

export type CheckoutInput = {
  productId: string;
  period: "monthly" | "yearly";
  planType: string;
  label: string;
  amountEur: number;
  transactionId: string;
  userId: string;
  email: string;
  fullName: string;
  successUrl: string;
  callbackUrl: string;
};

/** Crée (ou construit) la page de paiement carte pour une commande. */
export async function createCardCheckout(input: CheckoutInput): Promise<Result<CheckoutSession>> {
  const key = apiKey();

  if (key) {
    const payload = {
      amount: Number(input.amountEur.toFixed(2)),
      currency: "EUR",
      reference: input.transactionId,
      customer_email: input.email,
      customer_name: input.fullName,
      description: `Abonnement ${input.label} (${input.period === "yearly" ? "annuel" : "mensuel"}) — Sam flash 2.0`,
      success_url: input.successUrl,
      cancel_url: input.successUrl,
      callback_url: input.callbackUrl,
      metadata: {
        transaction_id: input.transactionId,
        user_id: input.userId,
        email: input.email,
        plan: input.planType,
        product_id: input.productId,
        period: input.period,
      },
    };
    console.log("[chariow] create checkout payload", JSON.stringify(payload));
    try {
      const res = await fetch("https://api.chariow.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      console.log("[chariow] create checkout response", res.status, text.slice(0, 800));
      if (res.ok) {
        let json: Record<string, unknown> = {};
        try {
          json = JSON.parse(text) as Record<string, unknown>;
        } catch {
          json = {};
        }
        const data = (json["data"] as Record<string, unknown>) ?? json;
        const url =
          (typeof data["checkout_url"] === "string" && data["checkout_url"]) ||
          (typeof data["url"] === "string" && data["url"]) ||
          (typeof data["payment_link"] === "string" && data["payment_link"]) ||
          null;
        const sessionId =
          (typeof data["id"] === "string" && data["id"]) ||
          (typeof data["session_id"] === "string" && data["session_id"]) ||
          null;
        if (url) return { ok: true, data: { url, sessionId } };
      }
    } catch (error) {
      console.error("[chariow] create checkout error", error);
    }
    // En cas d'échec de l'API, on retombe sur les liens de commande.
  }

  const urls = checkoutUrls();
  const base =
    urls[`${input.productId}_${input.period}`.toLowerCase()] ??
    urls[input.productId.toLowerCase()] ??
    urls["default"];
  if (!base) {
    return {
      ok: false,
      message:
        "Le paiement par carte n'est pas encore configuré. Enregistrez vos liens Chariow pour l'activer.",
    };
  }

  const url = new URL(base);
  url.searchParams.set("reference", input.transactionId);
  url.searchParams.set("transaction_id", input.transactionId);
  url.searchParams.set("user_id", input.userId);
  url.searchParams.set("email", input.email);
  url.searchParams.set("plan", input.planType);
  url.searchParams.set("product_id", input.productId);
  url.searchParams.set("period", input.period);
  url.searchParams.set("redirect_url", input.successUrl);
  console.log("[chariow] checkout link", url.toString());
  return { ok: true, data: { url: url.toString(), sessionId: null } };
}
