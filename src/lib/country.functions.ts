import { createServerFn } from "@tanstack/react-start";

/**
 * Détecte le pays de l'utilisateur à partir de l'en-tête géographique fourni
 * par l'hébergeur (Vercel : x-vercel-ip-country, Cloudflare : cf-ipcountry).
 * Renvoie null si l'information n'est pas disponible.
 */
export const detectCountry = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const raw =
    request?.headers.get("x-vercel-ip-country") ??
    request?.headers.get("cf-ipcountry") ??
    "";
  const code = raw.trim().toUpperCase();
  return { code: /^[A-Z]{2}$/.test(code) ? code : null };
});
