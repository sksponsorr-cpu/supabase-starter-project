import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";

async function assertAdmin(context: {
  supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null; error: unknown }> };
  userId: string;
  claims?: unknown;
}) {
  const claims = context.claims as { email?: unknown } | null;
  const email = typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : "";
  if (email && OWNER_EMAILS.includes(email)) return;
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || data !== true) throw new Error("Accès refusé");
}

export type MigrateResult = {
  migrated: number;
  failed: { path: string; reason: string }[];
  remaining: number;
};

const MIME: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Copie quelques anciens fichiers de Supabase Storage vers Cloudflare R2,
 * vérifie qu'ils sont lisibles, puis fait pointer les créations vers R2.
 * Les fichiers d'origine ne sont PAS supprimés de Supabase (sécurité).
 */
export const adminMigrateToR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number; skipPaths?: string[] }) => ({
    limit: Math.min(Math.max(Number(input?.limit ?? 2), 1), 3),
    skipPaths: Array.isArray(input?.skipPaths) ? input.skipPaths.slice(0, 500).map(String) : [],
  }))
  .handler(async ({ data, context }): Promise<MigrateResult> => {
    await assertAdmin(context);
    const r2 = await import("@/lib/services/r2.server");
    if (!r2.isR2Configured()) throw new Error("Cloudflare R2 n'est pas configuré.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Chemins encore sur Supabase (créations, puis galerie)
    const paths: string[] = [];
    const add = (list: (string | null)[] | null) => {
      for (const p of list ?? []) {
        if (p && !data.skipPaths.includes(p) && !paths.includes(p)) paths.push(p);
      }
    };
    const { data: gens } = await supabaseAdmin
      .from("generations")
      .select("storage_path")
      .not("storage_path", "is", null)
      .order("created_at", { ascending: true })
      .limit(data.limit + data.skipPaths.length);
    add((gens ?? []).map((g) => g.storage_path));
    if (paths.length < data.limit) {
      const { data: gal } = await supabaseAdmin
        .from("community_gallery")
        .select("storage_path")
        .not("storage_path", "is", null)
        .order("created_at", { ascending: true })
        .limit(data.limit + data.skipPaths.length);
      add((gal ?? []).map((g) => g.storage_path));
    }

    let migrated = 0;
    const failed: { path: string; reason: string }[] = [];

    for (const path of paths.slice(0, data.limit)) {
      try {
        const { data: blob, error } = await supabaseAdmin.storage.from("generations").download(path);
        if (error || !blob) throw new Error("Téléchargement Supabase impossible");
        const ext = path.split(".").pop()?.toLowerCase() ?? "";
        const type = MIME[ext] ?? (blob.type || "application/octet-stream");
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (bytes.length === 0) throw new Error("Fichier vide");

        const url = await r2.uploadToR2(path, bytes, type);

        // Vérifie que le fichier est bien lisible publiquement avant de changer quoi que ce soit
        const head = await fetch(url, { method: "HEAD", cache: "no-store" });
        if (!head.ok) throw new Error(`Lecture publique R2 impossible (${head.status})`);

        const g = await supabaseAdmin
          .from("generations")
          .update({ media_url: url, storage_path: null })
          .eq("storage_path", path);
        if (g.error) throw new Error("Mise à jour des créations impossible");
        const c = await supabaseAdmin
          .from("community_gallery")
          .update({ media_url: url, storage_path: null })
          .eq("storage_path", path);
        if (c.error) throw new Error("Mise à jour de la galerie impossible");
        migrated++;
      } catch (e) {
        failed.push({ path, reason: e instanceof Error ? e.message : String(e) });
      }
    }

    const { count: c1 } = await supabaseAdmin
      .from("generations")
      .select("id", { count: "exact", head: true })
      .not("storage_path", "is", null);
    const { count: c2 } = await supabaseAdmin
      .from("community_gallery")
      .select("id", { count: "exact", head: true })
      .not("storage_path", "is", null);

    return { migrated, failed, remaining: (c1 ?? 0) + (c2 ?? 0) };
  });
