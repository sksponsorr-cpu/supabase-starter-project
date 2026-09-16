/**
 * Envoi d'e-mails transactionnels via Resend (facultatif).
 * Sans clé RESEND_API_KEY, l'appelant retombe sur l'envoi natif Supabase.
 */
export function hasResend(): boolean {
  return Boolean(process.env["RESEND_API_KEY"]);
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; message?: string }> {
  const key = process.env["RESEND_API_KEY"];
  if (!key) return { ok: false, message: "Service d'e-mail non configuré." };
  const from = process.env["RESEND_FROM"] ?? "Sam flash <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Resend a refusé l'envoi [${response.status}]: ${body}`);
    return { ok: false, message: `Envoi refusé par le service d'e-mail (${response.status}).` };
  }
  return { ok: true };
}

export function invitationHtml(link: string, roleLabel: string): string {
  return `<!doctype html><html lang="fr"><body style="font-family:system-ui,-apple-system,sans-serif;background:#0b1020;color:#f5f6fa;padding:32px">
  <h1 style="font-size:22px;margin:0 0 12px">Invitation à rejoindre Sam flash 2.0</h1>
  <p style="margin:0 0 16px;line-height:1.5">Vous avez été invité comme <strong>${roleLabel}</strong>.
  Cliquez sur le bouton ci-dessous pour créer votre accès.</p>
  <p><a href="${link}" style="display:inline-block;background:#6b5bff;color:#fff;padding:14px 24px;border-radius:999px;text-decoration:none;font-weight:600">Accepter l'invitation</a></p>
  <p style="margin:24px 0 0;font-size:12px;color:#a8adc0">Si le bouton ne fonctionne pas, copiez ce lien : ${link}</p>
  </body></html>`;
}
