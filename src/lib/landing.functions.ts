import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LandingContent = {
  title: string;
  text: string;
  introVideo: string;
  videos: { url: string; caption: string }[];
  faq: { q: string; a: string }[];
  showcase: { cat: string; url: string; caption: string }[];
};

export const SHOWCASE_CATEGORIES = ["pub", "clone", "avatar", "scene"] as const;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
// Seules les adresses https sont acceptées (évite les liens dangereux).
const url = (v: unknown) => {
  const u = str(v, 600);
  return /^https:\/\//i.test(u) ? u : "";
};

function clean(raw: unknown): LandingContent {
  const r = (raw ?? {}) as Record<string, unknown>;
  const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.slice(0, 12) : []);
  return {
    title: str(r["title"], 120),
    text: str(r["text"], 400),
    introVideo: url(r["introVideo"]),
    videos: list(r["videos"])
      .map((v) => ({ url: url(v?.["url"]), caption: str(v?.["caption"], 80) }))
      .filter((v) => v.url),
    faq: list(r["faq"])
      .map((f) => ({ q: str(f?.["q"], 160), a: str(f?.["a"], 600) }))
      .filter((f) => f.q && f.a),
    showcase: list(r["showcase"])
      .map((v) => ({ cat: str(v?.["cat"], 20), url: url(v?.["url"]), caption: str(v?.["caption"], 80) }))
      .filter((v) => v.url && (SHOWCASE_CATEGORIES as readonly string[]).includes(v.cat))
      .slice(0, 24),
  };
}

/** Contenu public de la page d'accueil. */
export const getLanding = createServerFn({ method: "GET" }).handler(async (): Promise<LandingContent> => {
  const { publicSupabase } = await import("@/lib/payments/public-client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = publicSupabase() as any;
  const { data } = await db.from("app_settings").select("landing_content").eq("id", "global").maybeSingle();
  return clean(data?.landing_content);
});

async function assertLandingAdmin(context: {
  supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null }> };
  userId: string;
  claims?: unknown;
}) {
  const { OWNER_EMAILS } = await import("@/lib/owners");
  const claims = context.claims as { email?: unknown } | null;
  const email = typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : "";
  if (email && OWNER_EMAILS.includes(email)) return;
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (data !== true) throw new Error("Accès refusé");
}

/** Enregistre le contenu de la page d'accueil (administrateur ou propriétaire). */
export const setLanding = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => clean(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertLandingAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { error } = await db.from("app_settings").upsert({ id: "global", landing_content: data });
    if (error) return { ok: false as const, message: `Enregistrement impossible : ${error.message}` };
    return { ok: true as const };
  });

const MAX_VIDEO = 20 * 1024 * 1024;

/** Envoie une vidéo depuis la galerie vers Cloudflare R2 et renvoie son lien permanent. */
export const uploadLandingVideo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    if (!(input instanceof FormData)) throw new Error("Formulaire invalide");
    return input;
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertLandingAdmin(context);
    const file = data.get("file");
    if (!(file instanceof File)) return { ok: false as const, message: "Aucun fichier reçu." };
    if (!file.type.startsWith("video/")) return { ok: false as const, message: "Ce fichier n'est pas une vidéo." };
    if (file.size > MAX_VIDEO) return { ok: false as const, message: "Vidéo trop lourde pour cet envoi (20 Mo maximum)." };
    const r2 = await import("@/lib/r2.server");
    if (!r2.isR2Configured()) return { ok: false as const, message: "Cloudflare R2 n'est pas configuré." };
    const ext = file.type === "video/quicktime" ? "mov" : file.type === "video/webm" ? "webm" : "mp4";
    try {
      const link = await r2.uploadToR2(
        `landing/${crypto.randomUUID()}.${ext}`,
        new Uint8Array(await file.arrayBuffer()),
        file.type,
      );
      return { ok: true as const, url: link };
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : "Envoi impossible." };
    }
  });

const MAX_DIRECT = 500 * 1024 * 1024;

/** Prépare un envoi direct (navigateur → Cloudflare R2) pour les grosses vidéos. */
export const presignLandingUpload = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const r = (input ?? {}) as Record<string, unknown>;
    return { type: str(r["type"], 60), size: typeof r["size"] === "number" ? r["size"] : 0 };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertLandingAdmin(context);
    if (!data.type.startsWith("video/")) return { ok: false as const, message: "Ce fichier n'est pas une vidéo." };
    if (data.size > MAX_DIRECT) return { ok: false as const, message: "Vidéo trop lourde (500 Mo maximum)." };
    const r2 = await import("@/lib/r2.server");
    if (!r2.isR2Configured()) return { ok: false as const, message: "Cloudflare R2 n'est pas configuré." };
    const ext = data.type === "video/quicktime" ? "mov" : data.type === "video/webm" ? "webm" : "mp4";
    const { uploadUrl, publicUrl } = await r2.presignR2Put(`landing/${crypto.randomUUID()}.${ext}`);
    return { ok: true as const, uploadUrl, publicUrl };
  });
