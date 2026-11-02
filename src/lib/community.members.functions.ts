import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Membres de la communauté : profils avec leur nombre de publications. */
export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email, bio, avatar_url")
      .limit(200);
    const { data: pubs } = await supabaseAdmin.from("resources").select("author_id").eq("published", true).not("author_id", "is", null);
    const counts = new Map<string, number>();
    for (const p of pubs ?? []) counts.set(p.author_id as string, (counts.get(p.author_id as string) ?? 0) + 1);
    return (profiles ?? [])
      .map((p) => ({
        id: p.id as string,
        name: (p.display_name as string | null)?.trim() || (p.email ? (p.email as string).split("@")[0] : "Membre"),
        bio: (p.bio as string | null) ?? "",
        avatarUrl: (p.avatar_url as string | null) ?? null,
        publications: counts.get(p.id as string) ?? 0,
      }))
      .sort((a, b) => b.publications - a.publications);
  });
