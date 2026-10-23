import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type Formation = {
  id: string;
  title: string;
  summary: string | null;
  videoUrl: string;
  position: number;
};

type Row = { id: string; title: string; summary: string | null; video_url: string; position: number };

const toFormation = (r: Row): Formation => ({
  id: r.id,
  title: r.title,
  summary: r.summary,
  videoUrl: r.video_url,
  position: r.position,
});

async function isAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  return data === true;
}

/** Liste publique des modules, dans l'ordre de la formation. */
export const listFormations = createServerFn({ method: "GET" }).handler(async (): Promise<Formation[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("formations")
    .select("id, title, summary, video_url, position")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[formations] listFormations", error.message);
    return [];
  }
  return ((data ?? []) as Row[]).map(toFormation);
});

/** Administration : tous les modules. */
export const adminListFormations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Formation[]> => {
    if (!(await isAdmin(context))) throw new Error("Accès refusé");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("formations")
      .select("id, title, summary, video_url, position")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    return ((data ?? []) as Row[]).map(toFormation);
  });

/** Administration : ajoute un module à la fin de la formation. */
export const adminAddFormation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(2, "Titre trop court").max(120),
        summary: z.string().trim().max(500).optional(),
        videoUrl: z.string().trim().url("Lien vidéo invalide").max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) return { ok: false as const, message: "Accès refusé." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: last } = await supabaseAdmin
      .from("formations")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = Number(last?.position ?? 0) + 1;
    const { error } = await supabaseAdmin.from("formations").insert({
      title: data.title,
      summary: data.summary || null,
      video_url: data.videoUrl,
      position,
    });
    if (error) {
      console.error("[formations] adminAddFormation", error.message);
      return { ok: false as const, message: "Ajout impossible." };
    }
    return { ok: true as const, message: "Module ajouté." };
  });

/** Administration : supprime un module. */
export const adminDeleteFormation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) return { ok: false as const, message: "Accès refusé." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("formations").delete().eq("id", data.id);
    if (error) return { ok: false as const, message: "Suppression impossible." };
    return { ok: true as const, message: "Module supprimé." };
  });
