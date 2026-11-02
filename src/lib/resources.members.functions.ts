import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Publication par les membres : ressource en attente de validation, pièces jointes, téléchargement. */

const BUCKET = "resources";
const MAX_FILES = 5;
const MAX_SIZE = 100 * 1024 * 1024; // 100 Mo (vidéos)
const ALLOWED = [
  "image/jpeg", "image/png", "image/webp",
  "application/pdf",
  "video/mp4", "video/webm",
  // Compétences (skills) : fichiers de travail
  "text/plain", "text/markdown", "application/json", "application/zip", "application/x-zip-compressed",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_FILES_TOTAL = 5;

/** Crée une ressource du membre. Elle n'est visible qu'après validation par l'administrateur. */
export const submitMemberResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { category: string; kind: string; title: string; summary: string; body: string }) =>
    z
      .object({
        category: z.enum(["formations", "prompts", "niches", "actu", "skills"]),
        kind: z.enum(["formation", "article", "prompt", "video", "niche", "skill"]),
        title: z.string().trim().min(3).max(160),
        summary: z.string().trim().min(5).max(300),
        body: z.string().trim().max(20000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("resources")
      .insert({ ...data, preview: true, published: false, author_id: context.userId })
      .select("id")
      .single();
    if (error || !row) return { ok: false as const, id: null };
    return { ok: true as const, id: row.id as string };
  });

/** Réserve une place pour une pièce jointe et renvoie le lien d'envoi. */
export const requestUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { resourceId: string; name: string; mime: string; size: number }) =>
    z
      .object({
        resourceId: z.string().uuid(),
        name: z.string().trim().min(1).max(160),
        mime: z.string(),
        size: z.number().int().positive().max(MAX_SIZE),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!ALLOWED.includes(data.mime)) return { ok: false as const, message: `Type de fichier non autorisé : ${data.mime || "inconnu"}.` };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res } = await supabaseAdmin.from("resources").select("author_id").eq("id", data.resourceId).maybeSingle();
    if (!res || res.author_id !== context.userId) return { ok: false as const, message: "Publication introuvable." };
    const { count } = await supabaseAdmin.from("resource_files").select("id", { count: "exact", head: true }).eq("resource_id", data.resourceId);
    if ((count ?? 0) >= MAX_FILES_TOTAL) return { ok: false as const, message: `Maximum ${MAX_FILES_TOTAL} fichiers par publication.` };

    const safe = data.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${context.userId}/${data.resourceId}/${crypto.randomUUID()}-${safe}`;
    const { data: signed, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !signed) return { ok: false as const, message: "Envoi impossible pour le moment." };
    await supabaseAdmin.from("resource_files").insert({
      resource_id: data.resourceId,
      path,
      name: data.name,
      mime: data.mime,
      size: data.size,
    });
    return { ok: true as const, uploadUrl: signed.signedUrl as string };
  });

/** Lien de téléchargement temporaire. Réservé aux abonnés (et à l'auteur). */
export const getDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileId: string }) => z.object({ fileId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { activePlan } = await import("@/lib/services/access.server");
    const { hasResourceAccess } = await import("@/lib/resources.data");
    const { data: file } = await supabaseAdmin.from("resource_files").select("path, resource_id").eq("id", data.fileId).maybeSingle();
    if (!file) return { ok: false as const, url: null, message: "Fichier introuvable." };
    const { data: res } = await supabaseAdmin.from("resources").select("author_id").eq("id", file.resource_id).maybeSingle();
    const { plan } = await activePlan(context.userId);
    const allowed = hasResourceAccess(plan) || res?.author_id === context.userId;
    if (!allowed) return { ok: false as const, url: null, message: "Réservé aux abonnés." };
    const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(file.path as string, 120);
    return { ok: Boolean(signed), url: signed?.signedUrl ?? null, message: null };
  });
