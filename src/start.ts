import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
// Le domaine personnalisé passe par un proxy : l'hôte interne de la requête ne
// correspond pas à l'origine du navigateur. On autorise donc explicitement les
// domaines du site en plus de l'origine de la requête.
const ALLOWED_HOSTS = ["sam-flash.lat", "www.sam-flash.lat"];

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
  origin: (value, ctx) => {
    let originHost = "";
    try {
      originHost = new URL(String(value)).host;
    } catch {
      return false;
    }
    if (ALLOWED_HOSTS.includes(originHost)) return true;
    const headers = ctx.request.headers;
    const forwarded = headers.get("x-forwarded-host");
    const host = headers.get("host");
    if (forwarded && forwarded === originHost) return true;
    if (host && host === originHost) return true;
    try {
      return new URL(ctx.request.url).host === originHost;
    } catch {
      return false;
    }
  },
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
