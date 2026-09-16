/** Origine publique du site : domaine de production, sinon hôte de la requête. */
export const PRODUCTION_ORIGIN = "https://sam-flash.lat";

export async function resolvePublicOrigin(): Promise<string> {
  const configured = process.env["PUBLIC_SITE_URL"];
  if (configured) return configured.replace(/\/+$/, "");
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const host = request?.headers.get("x-forwarded-host") ?? request?.headers.get("host") ?? "";
    const proto = request?.headers.get("x-forwarded-proto") ?? "https";
    // Les hôtes d'aperçu protégés renvoient 401 aux appels externes (webhooks, e-mails).
    const isPreview =
      host.includes("id-preview") || host.includes("localhost") || host.startsWith("127.");
    if (host && !isPreview) return `${proto}://${host}`;
  } catch {
    // Hors contexte de requête : on retombe sur le domaine de production.
  }
  return PRODUCTION_ORIGIN;
}
