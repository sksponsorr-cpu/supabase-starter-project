import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LandingContent = {
  title: string;
  text: string;
  introVideo: string;
  videos: { url: string; caption: string }[];
  faq: { q: string; a: string }[];
};

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

/** Enregistre le contenu de la page d'accueil (administrateur). */
export const setLanding = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => clean(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) throw new Error("Accès refusé");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = context.supabase as any;
    const { error } = await db.from("app_settings").update({ landing_content: data }).eq("id", "global");
    if (error) return { ok: false as const, message: "Enregistrement impossible." };
    return { ok: true as const };
  });
