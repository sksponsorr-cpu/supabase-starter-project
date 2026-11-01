import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Profils : affichage public (nom, présentation, publications) et modification de son propre profil. */

type ProfileRow = { id: string; display_name: string | null; email: string | null; bio: string | null; avatar_url: string | null };

function nameOf(p: ProfileRow): string {
  return p.display_name?.trim() || (p.email ? p.email.split("@")[0] : "Membre");
}

/** Profil public d'une personne, avec ses publications. */
export const getProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { activePlan } = await import("@/lib/services/access.server");
    const { hasResourceAccess } = await import("@/lib/resources.data");

    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email, bio, avatar_url")
      .eq("id", data.id)
      .maybeSingle();
    if (!p) return null;
    const profile = p as ProfileRow;

    const { plan } = await activePlan(context.userId);
    const unlocked = hasResourceAccess(plan);

    const { data: pubs } = await supabaseAdmin
      .from("resources")
      .select("id, category, kind, title, summary, body, preview, created_at")
      .eq("author_id", data.id)
      .eq("published", true)
      .order("created_at", { ascending: false });

    const isMe = profile.id === context.userId;
    const { data: waiting } = isMe
      ? await supabaseAdmin
          .from("resources")
          .select("id, kind, title, created_at")
          .eq("author_id", data.id)
          .eq("published", false)
          .order("created_at", { ascending: false })
      : { data: [] as { id: string; kind: string; title: string; created_at: string }[] };

    return {
      waiting: (waiting ?? []).map((r) => ({ id: r.id as string, kind: r.kind as string, title: r.title as string, createdAt: r.created_at as string })),
      id: profile.id,
      name: nameOf(profile),
      bio: profile.bio ?? "",
      avatarUrl: profile.avatar_url,
      isMe,
      publications: (pubs ?? []).map((r) => ({
        id: r.id as string,
        category: r.category as string,
        kind: r.kind as string,
        title: r.title as string,
        summary: r.summary as string,
        body: unlocked ? (r.body as string) : null,
        createdAt: r.created_at as string,
      })),
    };
  });

/** Modifie son propre profil : nom affiché et présentation. */
export const saveMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { displayName: string; bio: string }) =>
    z.object({ displayName: z.string().trim().min(2).max(60), bio: z.string().trim().max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ display_name: data.displayName, bio: data.bio })
      .eq("id", context.userId);
    return { ok: !error };
  });

/** Identifiant de la personne connectée. */
export const getMyUserId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ id: context.userId }));
