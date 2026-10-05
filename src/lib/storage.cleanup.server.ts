import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Nettoie automatiquement les anciennes générations
 * Supprime les vidéos générées il y a plus de 60 jours
 * Limite l'historique à 100 générations par utilisateur
 */

export const cleanupOldMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    try {
      // 1. Supprimer les vidéos de plus de 60 jours
      const cutoffDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

      const { data: oldMedia, error: fetchError } = await db
        .from("generated_media")
        .select("id, media_url, storage_path")
        .eq("user_id", context.userId)
        .lt("created_at", cutoffDate);

      if (!fetchError && oldMedia && oldMedia.length > 0) {
        // Supprimer les fichiers du storage
        const pathsToDelete = oldMedia
          .map((item: any) => item.storage_path)
          .filter(Boolean);

        if (pathsToDelete.length > 0) {
          await db.storage.from("generated-media").remove(pathsToDelete);
        }

        // Supprimer les entrées de la base de données
        const idsToDelete = oldMedia.map((item: any) => item.id);
        await db
          .from("generated_media")
          .delete()
          .in("id", idsToDelete);
      }

      // 2. Limiter l'historique à 100 générations par utilisateur
      const { count } = await db
        .from("generated_media")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId);

      if ((count ?? 0) > 100) {
        const { data: toKeep } = await db
          .from("generated_media")
          .select("id")
          .eq("user_id", context.userId)
          .order("created_at", { ascending: false })
          .limit(100);

        if (toKeep && toKeep.length === 100) {
          const keepIds = toKeep.map((item: any) => item.id);
          const { data: toDelete } = await db
            .from("generated_media")
            .select("id, storage_path")
            .eq("user_id", context.userId)
            .not(
              "id",
              "in",
              `(${keepIds.map((id) => `'${id}'`).join(",")})`
            );

          if (toDelete && toDelete.length > 0) {
            const pathsToDelete = toDelete
              .map((item: any) => item.storage_path)
              .filter(Boolean);

            if (pathsToDelete.length > 0) {
              await db.storage.from("generated-media").remove(pathsToDelete);
            }

            await db
              .from("generated_media")
              .delete()
              .in(
                "id",
                toDelete.map((item: any) => item.id)
              );
          }
        }
      }

      return {
        ok: true,
        message: "Stockage nettoyé avec succès",
        cleaned: oldMedia?.length ?? 0,
      };
    } catch (error) {
      console.error("[Storage Cleanup Error]:", error);
      return {
        ok: false,
        message: "Erreur lors du nettoyage du stockage",
      };
    }
  });

/**
 * Statistiques de stockage utilisateur
 */
export const getStorageStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    try {
      const { data: media, error } = await db
        .from("generated_media")
        .select("id, file_size")
        .eq("user_id", context.userId);

      if (error) {
        return { ok: false, totalSize: 0, count: 0 };
      }

      const totalSize = (media ?? []).reduce(
        (sum: number, item: any) => sum + (item.file_size ?? 0),
        0
      );
      const count = media?.length ?? 0;

      // Convertir en MB
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      const maxSizeMB = 500; // Limite : 500 MB par utilisateur

      return {
        ok: true,
        totalSize: Number(totalSizeMB),
        maxSize: maxSizeMB,
        count,
        percentUsed: ((Number(totalSizeMB) / maxSizeMB) * 100).toFixed(1),
      };
    } catch (error) {
      console.error("[Storage Stats Error]:", error);
      return { ok: false, totalSize: 0, count: 0 };
    }
  });
