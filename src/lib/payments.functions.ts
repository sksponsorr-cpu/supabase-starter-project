import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  SUPPORTED_COUNTRIES,
  findCountry,
  normalizeMobile,
  operatorPrefixes,
} from "@/lib/payments/countries";

export type PriceRow = {
  id: string;
  label: string;
  tier: string;
  amount_eur: number;
  amount_eur_yearly: number | null;
  active: boolean;
  sort_order: number;
};

export type BillingPeriod = "monthly" | "yearly";

/** Liste publique des offres et de leur prix en euros. */
export const listPrices = createServerFn({ method: "GET" }).handler(async (): Promise<PriceRow[]> => {
  const { publicSupabase } = await import("@/lib/payments/public-client.server");
  const { data } = await publicSupabase()
    .from("product_prices")
    .select("id, label, tier, amount_eur, amount_eur_yearly, active, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((row) => ({
    ...row,
    amount_eur: Number(row.amount_eur),
    amount_eur_yearly: row.amount_eur_yearly === null ? null : Number(row.amount_eur_yearly),
  }));
});

/** Pays SwyChr pris en charge. */
export const listCountries = createServerFn({ method: "GET" }).handler(async () => SUPPORTED_COUNTRIES);

/** Moyens de paiement disponibles pour un pays. */
export const listPaymentMethods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { countryCode: string }) =>
    z.object({ countryCode: z.string().length(2) }).parse(input),
  )
  .handler(async ({ data }) => {
    const country = findCountry(data.countryCode);
    if (!country) return { ok: false as const, message: "Pays non pris en charge." };

    const { fetchPayoutMethods } = await import("@/lib/services/swychr.server");
    const result = await fetchPayoutMethods(country.code);
    if (!result.ok) return { ok: false as const, message: result.message };
    // RDC : seuls Airtel, Orange et M-Pesa sont conservés (Afrimoney retiré).
    const methods =
      country.code === "CD"
        ? result.data.filter((m) =>
            ["airtel", "orange", "mpesa", "m-pesa", "vodacom"].some((k) =>
              `${m.label} ${m.code}`.toLowerCase().includes(k),
            ),
          )
        : result.data;
    return { ok: true as const, methods };
  });

/** Devis : conversion du prix EUR vers la devise locale du pays choisi. */
export const quotePrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string; countryCode: string; period?: string }) =>
    z
      .object({
        productId: z.string().min(1),
        countryCode: z.string().length(2),
        period: z.enum(["monthly", "yearly"]).default("monthly"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const country = findCountry(data.countryCode);
    if (!country) return { ok: false as const, message: "Pays non pris en charge." };

    const { data: price } = await context.supabase
      .from("product_prices")
      .select("id, label, tier, amount_eur, amount_eur_yearly")
      .eq("id", data.productId)
      .eq("active", true)
      .maybeSingle();
    if (!price) return { ok: false as const, message: "Offre introuvable." };

    const amountEur =
      data.period === "yearly" && price.amount_eur_yearly !== null
        ? Number(price.amount_eur_yearly)
        : Number(price.amount_eur);

    const { convertFromEur } = await import("@/lib/services/fx.server");
    const conv = await convertFromEur(amountEur, country.currency, country.zeroDecimal);
    if (!conv.ok) return { ok: false as const, message: conv.message };

    // Frais SwyChr ajoutés pour que le total affiché corresponde au prélèvement réel.
    const { addPaymentFees } = await import("@/lib/payments/fees");
    const fees = addPaymentFees(conv.amount, country.zeroDecimal);

    return {
      ok: true as const,
      label: price.label,
      period: data.period,
      amountEur,
      amountLocal: fees.total,
      baseAmountLocal: fees.base,
      feeLocal: fees.fee,
      currency: country.currency,
      rate: conv.rate,
    };
  });

/** Crée la commande en base puis génère le lien de paiement SwyChr. */
export const startPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        productId: z.string().min(1).max(40),
        countryCode: z.string().length(2),
        paymentMethod: z.string().min(1).max(60),
        mobile: z.string().min(6).max(20),
        fullName: z.string().min(2).max(80),
        period: z.enum(["monthly", "yearly"]).default("monthly"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const country = findCountry(data.countryCode);
    if (!country) return { ok: false as const, message: "Pays non pris en charge." };

    // L'e-mail est toujours celui du compte connecté.
    const email = typeof context.claims["email"] === "string" ? context.claims["email"] : null;
    if (!email) return { ok: false as const, message: "Adresse e-mail du compte introuvable." };

    const { data: price } = await context.supabase
      .from("product_prices")
      .select("id, label, tier, amount_eur, amount_eur_yearly")
      .eq("id", data.productId)
      .eq("active", true)
      .maybeSingle();
    if (!price) return { ok: false as const, message: "Offre introuvable." };

    const amountEur =
      data.period === "yearly" && price.amount_eur_yearly !== null
        ? Number(price.amount_eur_yearly)
        : Number(price.amount_eur);

    const { local: mobileLocal, international: mobile } = normalizeMobile(data.mobile, country);
    if (mobileLocal.length < 8) return { ok: false as const, message: "Numéro de téléphone invalide." };

    const { fetchPayoutMethods } = await import("@/lib/services/swychr.server");
    const methodsResult = await fetchPayoutMethods(country.code);
    if (!methodsResult.ok) return { ok: false as const, message: methodsResult.message };
    const selectedMethod = methodsResult.data.find(
      (method) => method.code.toLowerCase() === data.paymentMethod.toLowerCase(),
    );
    if (!selectedMethod) {
      return { ok: false as const, message: "Ce moyen de paiement n’est plus disponible." };
    }
    if (
      selectedMethod.length !== null &&
      mobileLocal.length !== selectedMethod.length &&
      mobile.length !== selectedMethod.length
    ) {
      return {
        ok: false as const,
        message: `Le numéro ${selectedMethod.label} doit contenir ${selectedMethod.length} chiffres.`,
      };
    }
    const expectedPrefixes = operatorPrefixes(country.code, selectedMethod.label);
    if (expectedPrefixes && !expectedPrefixes.some((prefix) => mobileLocal.startsWith(prefix))) {
      return {
        ok: false as const,
        message: `Ce numéro ne correspond pas au réseau ${selectedMethod.label}.`,
      };
    }


    const { convertFromEur } = await import("@/lib/services/fx.server");
    const conv = await convertFromEur(amountEur, country.currency, country.zeroDecimal);
    if (!conv.ok) return { ok: false as const, message: conv.message };

    const { addPaymentFees } = await import("@/lib/payments/fees");
    const fees = addPaymentFees(conv.amount, country.zeroDecimal);
    const totalLocal = fees.total;

    const transactionId = crypto.randomUUID();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: insertError } = await supabaseAdmin.from("orders").insert({
      transaction_id: transactionId,
      user_id: context.userId,
      product_id: price.id,
      tier: price.tier,
      status: "en_attente",
      period: data.period,
      amount_eur: amountEur,
      amount_local: totalLocal,
      currency: country.currency,
      exchange_rate: conv.rate,
      country_code: country.code,
      payment_method: selectedMethod.code,
      mobile,
      customer_name: data.fullName,
      customer_email: email,
    });
    if (insertError) return { ok: false as const, message: "Impossible d'enregistrer la commande." };

    // URL de callback transmise au prestataire : le jeton HMAC authentifie l'appel.
    const { callbackToken } = await import("@/lib/payments/token.server");
    // L'aperçu avec authentification renvoie 401 aux appels externes. Cette
    // adresse de développement stable autorise explicitement les webhooks.
    const callbackOrigin = "https://project--0eb49e5c-6fd1-4a1b-aac6-53a815ad5253-dev.lovable.app";
    const callbackUrl = `${callbackOrigin}/api/public/webhooks/payment-success?transaction_id=${transactionId}&token=${callbackToken(transactionId)}`;

    const { createPaymentLink } = await import("@/lib/services/swychr.server");
    const result = await createPaymentLink({
      countryCode: country.code,
      paymentMethod: selectedMethod.code,
      name: data.fullName,
      transactionId,
      // SwyChr ajoute lui-même les frais lorsque `pass_digital_charge` est actif.
      // Envoyer le montant de base évite de facturer ces frais deux fois.
      amount: fees.base,
      currency: country.currency,
      email,
      mobile,
      description: `Abonnement ${price.label} (${data.period === "yearly" ? "annuel" : "mensuel"}) — Sam flash 2.0`,
      callbackUrl,
    });

    if (!result.ok) {
      await supabaseAdmin
        .from("orders")
        .update({ status: "echouee", error_message: result.message })
        .eq("transaction_id", transactionId);
      return { ok: false as const, message: result.message };
    }

    await supabaseAdmin
      .from("orders")
      .update({
        provider_response: result.data.raw as never,
        payment_link: result.data.paymentLink,
        provider_transaction_id: result.data.providerTransactionId,
      })
      .eq("transaction_id", transactionId);

    return {
      ok: true as const,
      transactionId,
      paymentLink: result.data.paymentLink,
      amountLocal: totalLocal,
      baseAmountLocal: fees.base,
      feeLocal: fees.fee,
      currency: country.currency,
    };
  });

/** Origine publique stable utilisée pour les retours prestataire. */
const PUBLIC_ORIGIN = "https://project--0eb49e5c-6fd1-4a1b-aac6-53a815ad5253-dev.lovable.app";

/**
 * Paiement par carte bancaire (Chariow) : enregistre la commande puis renvoie
 * l'adresse de la page de paiement sécurisée, avec les métadonnées du compte.
 */
export const startCardPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        productId: z.string().min(1).max(40),
        fullName: z.string().min(2).max(80),
        period: z.enum(["monthly", "yearly"]).default("monthly"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const email = typeof context.claims["email"] === "string" ? context.claims["email"] : null;
    if (!email) return { ok: false as const, message: "Adresse e-mail du compte introuvable." };

    const { data: price } = await context.supabase
      .from("product_prices")
      .select("id, label, tier, amount_eur, amount_eur_yearly")
      .eq("id", data.productId)
      .eq("active", true)
      .maybeSingle();
    if (!price) return { ok: false as const, message: "Offre introuvable." };

    const amountEur =
      data.period === "yearly" && price.amount_eur_yearly !== null
        ? Number(price.amount_eur_yearly)
        : Number(price.amount_eur);

    const { planTypeFor } = await import("@/lib/plans");
    const planType = planTypeFor(price.id, data.period);

    const transactionId = crypto.randomUUID();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: insertError } = await supabaseAdmin.from("orders").insert({
      transaction_id: transactionId,
      user_id: context.userId,
      product_id: price.id,
      tier: price.tier,
      status: "en_attente",
      period: data.period,
      provider: "chariow",
      amount_eur: amountEur,
      amount_local: amountEur,
      currency: "EUR",
      exchange_rate: 1,
      country_code: "EU",
      payment_method: "card",
      mobile: "-",
      customer_name: data.fullName,
      customer_email: email,
    });
    if (insertError) return { ok: false as const, message: "Impossible d'enregistrer la commande." };

    const { createCardCheckout } = await import("@/lib/services/chariow.server");
    const result = await createCardCheckout({
      productId: price.id,
      period: data.period,
      planType,
      label: price.label,
      amountEur,
      transactionId,
      userId: context.userId,
      email,
      fullName: data.fullName,
      successUrl: `${PUBLIC_ORIGIN}/checkout/success?transaction_id=${transactionId}`,
      callbackUrl: `${PUBLIC_ORIGIN}/api/public/webhooks/chariow`,
    });

    if (!result.ok) {
      await supabaseAdmin
        .from("orders")
        .update({ status: "echouee", error_message: result.message })
        .eq("transaction_id", transactionId);
      return { ok: false as const, message: result.message };
    }

    await supabaseAdmin
      .from("orders")
      .update({
        payment_link: result.data.url,
        provider_session_id: result.data.sessionId,
      })
      .eq("transaction_id", transactionId);

    return { ok: true as const, transactionId, checkoutUrl: result.data.url, amountEur };
  });

/** Statut d'une commande : vérifié chez le prestataire puis renvoyé au client. */
export const getOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { transactionId: string }) =>
    z.object({ transactionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const PAID = ["paid", "success", "successful", "succeeded", "completed", "complete", "settled"];
    const FAILED = ["failed", "failure", "cancelled", "canceled", "expired", "declined", "rejected"];

    const { data: order } = await context.supabase
      .from("orders")
      .select(
        "transaction_id, provider_transaction_id, status, amount_local, currency, provider_message, error_message, tier, payment_link",
      )
      .eq("transaction_id", data.transactionId)
      .maybeSingle();
    if (!order) return { ok: false as const, message: "Commande introuvable." };

    if (order.status !== "en_attente") return { ok: true as const, order };

    const { fetchPaymentLinkStatus } = await import("@/lib/services/swychr.server");
    const remote = await fetchPaymentLinkStatus(order.provider_transaction_id ?? order.transaction_id);
    if (!remote.ok || !remote.data.status) return { ok: true as const, order };


    const normalized = remote.data.status?.toLowerCase() ?? "";
    let next: "payee" | "echouee" | null = null;
    if (PAID.includes(normalized)) next = "payee";
    else if (FAILED.includes(normalized)) next = "echouee";
    if (!next) return { ok: true as const, order };

    const { applyOrderOutcome } = await import("@/lib/payments/webhook.server");
    await applyOrderOutcome(order.transaction_id, next, remote.data.status, remote.data.raw);

    return {
      ok: true as const,
      order: { ...order, status: next, provider_message: remote.data.status },
    };
  });

