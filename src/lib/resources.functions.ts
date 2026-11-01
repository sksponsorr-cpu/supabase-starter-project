import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasResourceAccess } from "@/lib/resources.data";

/** Liste des ressources publiées, avec j'aime et commentaires. Le contenu complet n'est envoyé qu'aux abonnés. */
export const listResources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { category?: string | null }) => z.object({ category: z.string().nullable().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { activePlan } = await import("@/lib/services/access.server");
    const { plan } = await activePlan(context.userId);
    const unlocked = hasResourceAccess(plan);

    let q = supabaseAdmin.from("resources").select("*").eq("published", true).order("created_at", { ascending: false });
    if (data.category) q = q.eq("category", data.category);
    const { data: rows } = await q;
    const ids = (rows ?? []).map((r) => r.id as string);

    const authorIds = [...new Set((rows ?? []).map((r) => r.author_id as string | null).filter(Boolean) as string[])];
    const { data: authors } = authorIds.length
      ? await supabaseAdmin.from("profiles").select("id, display_name, email").in("id", authorIds)
      : { data: [] as { id: string; display_name: string | null; email: string | null }[] };
    const authorName = new Map((authors ?? []).map((a) => [a.id, a.display_name?.trim() || (a.email ? a.email.split("@")[0] : "Membre")]));

    const { data: likes } = ids.length
      ? await supabaseAdmin.from("resource_likes").select("resource_id, user_id").in("resource_id", ids)
      : { data: [] as { resource_id: string; user_id: string }[] };
    const { data: comments } = ids.length
      ? await supabaseAdmin.from("resource_comments").select("resource_id").in("resource_id", ids)
      : { data: [] as { resource_id: string }[] };

    const likeCount = new Map<string, number>();
    const likedByMe = new Set<string>();
    for (const l of likes ?? []) {
      likeCount.set(l.resource_id, (likeCount.get(l.resource_id) ?? 0) + 1);
      if (l.user_id === context.userId) likedByMe.add(l.resource_id);
    }
    const commentCount = new Map<string, number>();
    for (const c of comments ?? []) commentCount.set(c.resource_id, (commentCount.get(c.resource_id) ?? 0) + 1);

    return {
      unlocked,
      items: (rows ?? []).map((r) => {
        const canRead = unlocked || r.preview;
        return {
          id: r.id as string,
          category: r.category as string,
          kind: r.kind as string,
          title: r.title as string,
          summary: r.summary as string,
          authorId: (r.author_id as string | null) ?? null,
          authorName: r.author_id ? (authorName.get(r.author_id as string) ?? "Membre") : "Sam flash",
          body: canRead && unlocked ? (r.body as string) : null,
          preview: !!r.preview,
          createdAt: r.created_at as string,
          likes: likeCount.get(r.id as string) ?? 0,
          comments: commentCount.get(r.id as string) ?? 0,
          likedByMe: likedByMe.has(r.id as string),
        };
      }),
    };
  });

/** Ajoute ou retire son j'aime. */
export const toggleLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { resourceId: string }) => z.object({ resourceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("resource_likes")
      .select("resource_id")
      .eq("resource_id", data.resourceId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin.from("resource_likes").delete().eq("resource_id", data.resourceId).eq("user_id", context.userId);
      return { liked: false };
    }
    await supabaseAdmin.from("resource_likes").insert({ resource_id: data.resourceId, user_id: context.userId });
    return { liked: true };
  });

/** Liste les commentaires d'une ressource. */
export const listComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { resourceId: string }) => z.object({ resourceId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("resource_comments")
      .select("id, author_name, body, created_at")
      .eq("resource_id", data.resourceId)
      .order("created_at", { ascending: true });
    return rows ?? [];
  });

/** Ajoute un commentaire (1 000 caractères maximum). */
export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { resourceId: string; body: string }) =>
    z.object({ resourceId: z.string().uuid(), body: z.string().trim().min(1).max(1000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const claims = context.claims as { email?: unknown } | null;
    const name = typeof claims?.email === "string" ? claims.email.split("@")[0] : "Membre";
    const { error } = await supabaseAdmin.from("resource_comments").insert({
      resource_id: data.resourceId,
      user_id: context.userId,
      author_name: name,
      body: data.body,
    });
    return { ok: !error };
  });
