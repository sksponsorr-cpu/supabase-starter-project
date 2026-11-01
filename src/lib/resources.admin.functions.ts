import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Gestion des ressources depuis le bureau administrateur. Réservé aux administrateurs. */

async function assertAdmin(context: { userId: string; supabase: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = context.supabase as any;
  const { data, error } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || data !== true) throw new Error("Accès refusé");
}

const ResourceInput = z.object({
  id: z.string().uuid().optional(),
  category: z.enum(["formations", "prompts", "niches", "actu", "skills"]),
  kind: z.enum(["formation", "article", "prompt", "video", "niche", "actu", "skill"]),
  title: z.string().trim().min(3).max(200),
  summary: z.string().trim().max(500),
  body: z.string().max(20000),
  preview: z.boolean(),
  published: z.boolean(),
});

/** Toutes les ressources, y compris les brouillons. */
export const adminListResources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("resources").select("*").order("created_at", { ascending: false });
    return data ?? [];
  });

/** Crée ou modifie une ressource. */
export const adminSaveResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ResourceInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...fields } = data;
    const withAuthor = { ...fields, author_id: context.userId };
    const { error } = id
      ? await supabaseAdmin.from("resources").update(withAuthor).eq("id", id)
      : await supabaseAdmin.from("resources").insert(withAuthor);
    return { ok: !error, message: error?.message ?? null };
  });

/** Supprime une ressource (et ses j'aime et commentaires, par cascade). */
export const adminDeleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("resources").delete().eq("id", data.id);
    return { ok: !error };
  });
