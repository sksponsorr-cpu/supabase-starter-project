/**
 * Service d'envoi d'e-mails transactionnels via l'API Brevo (ex-Sendinblue).
 * La clé API `BREVO_API_KEY` est lue à l'exécution et n'est jamais exposée au client.
 */

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const DEFAULT_SENDER_EMAIL = "Supportgrok@sam-flash.lat";
const DEFAULT_SENDER_NAME = "Sam Flash 2.0";

export type BrevoEmailRecipient = {
  email: string;
  name?: string | null;
};

export type SendBrevoEmailInput = {
  to: BrevoEmailRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: { email: string; name?: string };
};

export function isBrevoConfigured(): boolean {
  return Boolean(process.env["BREVO_API_KEY"]);
}

/**
 * Envoie un e-mail via l'API SMTP transactionnelle de Brevo.
 */
export async function sendBrevoEmail(
  input: SendBrevoEmailInput,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env["BREVO_API_KEY"];
  if (!apiKey) {
    const errorMsg = "Clé API Brevo non configurée (BREVO_API_KEY manquante).";
    console.warn(`[BREVO] ${errorMsg}`);
    return { ok: false, error: errorMsg };
  }

  const payload = {
    sender: {
      email: DEFAULT_SENDER_EMAIL,
      name: DEFAULT_SENDER_NAME,
    },
    to: input.to.map((r) => ({
      email: r.email,
      ...(r.name ? { name: r.name } : {}),
    })),
    subject: input.subject,
    htmlContent: input.htmlContent,
    ...(input.textContent ? { textContent: input.textContent } : {}),
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  };

  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      const message =
        (typeof data["message"] === "string" && data["message"]) ||
        (typeof data["error"] === "string" && data["error"]) ||
        `Erreur HTTP ${res.status}`;
      console.error(`[BREVO] Échec d'envoi (${res.status}):`, message);
      return { ok: false, error: message };
    }

    const messageId = typeof data["messageId"] === "string" ? data["messageId"] : undefined;
    return { ok: true, messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Erreur de connexion Brevo.";
    console.error("[BREVO] Exception réseau:", error);
    return { ok: false, error };
  }
}

/** Formate une date ISO en format français lisible (ex: 3 octobre 2026 à 14h05 GMT). */
export function formatFrenchDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const months = [
      "janvier",
      "février",
      "mars",
      "avril",
      "mai",
      "juin",
      "juillet",
      "août",
      "septembre",
      "octobre",
      "novembre",
      "décembre",
    ];
    const day = d.getUTCDate();
    const month = months[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    const hours = String(d.getUTCHours()).padStart(2, "0");
    const minutes = String(d.getUTCMinutes()).padStart(2, "0");
    return `${day} ${month} ${year} à ${hours}h${minutes} GMT`;
  } catch {
    return isoString;
  }
}

/** Libellé officiel de l'offre pour les communications client. */
export function getPlanDisplayName(productId?: string | null, tier?: string | null): string {
  if (productId === "heavy" || tier === "superhearly" || tier === "superhearly_monthly") {
    return "Super Grok Heavy";
  }
  if (productId === "plus" || tier === "super_grok_plus") {
    return "Super Grok Plus";
  }
  return "Super Grok";
}

/** Quota quotidien en texte clair. */
export function getPlanQuotaText(productId?: string | null, tier?: string | null): string {
  if (productId === "heavy" || tier === "superhearly" || tier === "superhearly_monthly") {
    return "20 minutes de génération par jour";
  }
  if (productId === "plus" || tier === "super_grok_plus") {
    return "6 minutes 40 secondes de génération par jour";
  }
  return "3 minutes 20 secondes de génération par jour";
}

export type SubscriptionWelcomeInput = {
  toEmail: string;
  toName?: string | null;
  planName: string;
  quotaText: string;
  startedAt: string;
  endsAt: string;
};

/**
 * Envoie l'e-mail de bienvenue après la confirmation d'un paiement d'abonnement.
 */
export async function sendSubscriptionWelcomeEmail(
  input: SubscriptionWelcomeInput,
): Promise<{ ok: boolean; error?: string }> {
  const { toEmail, toName, planName, quotaText, startedAt, endsAt } = input;
  const startDate = formatFrenchDateTime(startedAt);
  const endDate = formatFrenchDateTime(endsAt);
  const appUrl = "https://sam-flash.lat/app";

  const subject = `Bienvenue dans ${planName} — Sam Flash 2.0`;

  const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f17; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b0f17; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background-color: #131b2e; border: 1px solid #1e293b; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <!-- En-tête avec logo -->
          <tr>
            <td style="padding: 36px 32px 24px 32px; text-align: center; border-bottom: 1px solid #1e293b;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Sam Flash 2.0</h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Studio de création IA</p>
            </td>
          </tr>

          <!-- Contenu principal -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #ffffff; line-height: 1.4;">
                Bienvenue ! Votre abonnement <span style="color: #38bdf8;">${planName}</span> est actif.
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                Merci pour votre confiance. Votre compte bénéficie dès maintenant de toutes les fonctionnalités et des quotas de votre offre.
              </p>

              <!-- Carte récapitulative -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0f172a; border: 1px solid #334155; border-radius: 16px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding-bottom: 12px; font-size: 13px; color: #94a3b8; font-weight: 500;">Offre souscrite</td>
                        <td style="padding-bottom: 12px; font-size: 14px; color: #f8fafc; font-weight: 600; text-align: right;">${planName}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 12px; font-size: 13px; color: #94a3b8; font-weight: 500;">Quota quotidien</td>
                        <td style="padding-bottom: 12px; font-size: 14px; color: #38bdf8; font-weight: 600; text-align: right;">${quotaText}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 12px; font-size: 13px; color: #94a3b8; font-weight: 500;">Date de début</td>
                        <td style="padding-bottom: 12px; font-size: 13px; color: #f8fafc; text-align: right;">${startDate}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #94a3b8; font-weight: 500;">Date d'échéance</td>
                        <td style="font-size: 13px; color: #f8fafc; text-align: right;">${endDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Bouton d'action -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #ffffff; color: #020617; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(255,255,255,0.15);">
                      Commencer à créer
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b; text-align: center;">
                Vos quotas se réinitialisent automatiquement chaque jour à 00h00 UTC.
              </p>
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="padding: 24px 32px; text-align: center; border-top: 1px solid #1e293b; background-color: #0b1120;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
                Besoin d'aide ? Contactez notre support à <a href="mailto:${DEFAULT_SENDER_EMAIL}" style="color: #94a3b8; text-decoration: underline;">${DEFAULT_SENDER_EMAIL}</a>.
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                © ${new Date().getUTCFullYear()} Sam Flash 2.0. Tous droits réservés.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textContent = `Bienvenue dans Sam Flash 2.0 !

Votre abonnement ${planName} est actif.

Détails de votre offre :
- Offre : ${planName}
- Quota : ${quotaText}
- Date de début : ${startDate}
- Date d'échéance : ${endDate}

Commencez à créer dès maintenant : ${appUrl}

Une question ? Contactez-nous à ${DEFAULT_SENDER_EMAIL}.
© ${new Date().getUTCFullYear()} Sam Flash 2.0.`;

  return await sendBrevoEmail({
    to: [{ email: toEmail, name: toName ?? undefined }],
    subject,
    htmlContent,
    textContent,
  });
}
