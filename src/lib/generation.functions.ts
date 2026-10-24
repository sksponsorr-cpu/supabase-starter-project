import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Formation = { id: string; title: string; summary: string; videoUrl: string; position: number };

const toFormation = (r: { id: string; title: string; summary: string | null; video_url: string; position: number }): Formation => ({
  id: r.id,
  title: r.title,
  summary: r.summary ?? "",
  videoUrl: r.video_url,
  position: r.position,
});

/** Modules publics, dans l'ordre d'ajout. */
export const listFormations = createServerFn({ method: "GET" }).handler(async (): Promise<Formation[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const { data } = await db.from("formations").select("id, title, summary, video_url, position").order("position", { ascending: true });
  return (data ?? []).map(toFormation);
});

/** Même règle que le bureau administrateur : e-mail propriétaire, ou rôle admin. */
async function assertAdmin(context: { userId: string; claims?: unknown; supabase: unknown }) {
  const { isOwnerEmail } = await import("@/lib/owners");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const claims = context.claims as { email?: unknown } | null;
  const email = typeof claims?.email === "string" ? claims.email : null;
  if (!isOwnerEmail(email)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || data !== true) throw new Error("Accès refusé");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

export const adminListFormations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Formation[]> => {
    const db = await assertAdmin(context);
    const { data } = await db.from("formations").select("id, title, summary, video_url, position").order("position", { ascending: true });
    return (data ?? []).map(toFormation);
  });

export const adminAddFormation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(3).max(120),
        summary: z.string().trim().max(1000).default(""),
        videoUrl: z.string().trim().url().max(2000),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    const { data: last } = await db.from("formations").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
    const { error } = await db.from("formations").insert({
      title: data.title,
      summary: data.summary,
      video_url: data.videoUrl,
      position: (last?.position ?? 0) + 1,
    });
    if (error) return { ok: false, message: "Impossible d'enregistrer le module." };
    return { ok: true, message: "Module publié." };
  });

export const adminDeleteFormation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    await db.from("formations").delete().eq("id", data.id);
    return { ok: true };
  });
