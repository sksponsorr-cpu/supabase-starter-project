import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Suivi des campagnes du vendeur. Lit la table `campaigns` (publications et leur génération liée).
 * Ne fournit aucune statistique de performance : Sam Flash ne publie pas sur les réseaux et ne mesure ni clics ni ventes.
 */
type Post = { status: "todo" | "launched" | "failed"; generation_id: string | null; title?: string };

export const listMyCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;

    const { data: campaigns, error } = await db
      .from("campaigns")
      .select("id, name, created_at, posts")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { ok: false as const, message: "Impossible de charger tes campagnes. Réessaie." };

    const rows = (campaigns ?? []) as { id: string; name: string; created_at: string; posts: Post[] }[];
    const genIds = rows.flatMap((c) => (c.posts ?? []).map((p) => p.generation_id).filter((x): x is string => !!x));

    // Statut réel de chaque génération liée (même lecture que get_campaign côté MCP).
    const genStatus = new Map<string, { status: string; media_url: string | null }>();
    if (genIds.length > 0) {
      const { data: gens } = await db.from("generations").select("id, status, media_url").in("id", genIds).eq("user_id", context.userId);
      for (const g of (gens ?? []) as { id: string; status: string; media_url: string | null }[]) {
        genStatus.set(g.id, { status: g.status, media_url: g.media_url });
      }
    }

    return {
      ok: true as const,
      campaigns: rows.map((c) => ({
        id: c.id,
        name: c.name,
        created_at: c.created_at,
        posts: (c.posts ?? []).map((p) => ({
          title: p.title ?? "Publication",
          status: p.status,
          generation_status: p.generation_id ? genStatus.get(p.generation_id)?.status ?? "introuvable" : null,
          media_url: p.generation_id ? genStatus.get(p.generation_id)?.media_url ?? null : null,
        })),
      })),
    };
  });
