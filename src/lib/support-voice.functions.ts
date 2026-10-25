import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Bucket Supabase privé pour les messages vocaux du support (à créer : Storage > New bucket > "support-voice", privé). */
const VOICE_BUCKET = "support-voice";

/**
 * Envoie un message vocal au support : l'audio est stocké dans le bucket privé,
 * et le chemin est renvoyé pour être joint au message de support.
 */
export const uploadSupportVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { audioBase64: string; mimeType: string }) =>
    z
      .object({
        audioBase64: z.string().min(100).max(3_000_000),
        mimeType: z.string().regex(/^audio\//),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const bytes = Buffer.from(data.audioBase64, "base64");
    if (bytes.length > 2_000_000) {
      return { ok: false as const, message: "Le message vocal est trop long (2 Mo maximum)." };
    }
    const ext = data.mimeType.includes("mp4") ? "m4a" : data.mimeType.includes("ogg") ? "ogg" : "webm";
    const path = `${context.userId}/${Date.now()}.${ext}`;
    const { error } = await context.supabase.storage
      .from(VOICE_BUCKET)
      .upload(path, bytes, { contentType: data.mimeType, upsert: false });
    if (error) return { ok: false as const, message: "Envoi du vocal impossible. Réessaie ou écris ton message." };
    return { ok: true as const, path };
  });

/** Lien temporaire pour écouter un message vocal. Réservé au staff (admin ou support). */
export const getSupportVoiceUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string }) =>
    z.object({ path: z.string().min(5).max(300).regex(/^[0-9a-f-]{36}\/[^/]+$/) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as {
      rpc: (fn: string, args: object) => PromiseLike<{ data: boolean | null }>;
    };
    const [isAdmin, isSupport] = await Promise.all([
      db.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      db.rpc("has_role", { _user_id: context.userId, _role: "support" }),
    ]);
    if (!isAdmin.data && !isSupport.data) return { ok: false as const, message: "Accès refusé." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(VOICE_BUCKET)
      .createSignedUrl(data.path, 3600);
    if (error || !signed) return { ok: false as const, message: "Vocal introuvable." };
    return { ok: true as const, url: signed.signedUrl };
  });
