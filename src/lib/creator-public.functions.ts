import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicVideo = {
  id: string;
  video_url: string;
  platform: string;
  published_at: string | null;
  eligible_views: number;
  verified_views: number;
  source: "manual" | "tiktok";
};

export type PublicCreator = {
  id: string;
  name: string;
  badge: "connecte" | "manuel";
  videos: PublicVideo[];
  totals: { videos: number; eligible_views: number };
};

/**
 * Profil public d'un créateur : seulement les vidéos validées et les vues.
 * Aucun gain, aucun e-mail, aucune donnée personnelle hors du prénom affiché.
 */
export const getPublicCreator = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<PublicCreator | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;

    const { data: prof } = await db.from("profiles").select("id, full_name").eq("id", data.id).maybeSingle();
    if (!prof) return null;

    const { data: vids } = await db
      .from("creator_videos")
      .select("id, video_url, platform, published_at, source, verified_views, eligible_views")
      .eq("user_id", data.id)
      .eq("status", "approved")
      .order("published_at", { ascending: false })
      .limit(60);

    const videos: PublicVideo[] = (vids ?? []).map((v: PublicVideo) => ({
      id: v.id,
      video_url: v.video_url,
      platform: v.platform,
      published_at: v.published_at,
      eligible_views: Number(v.eligible_views ?? 0),
      verified_views: Number(v.verified_views ?? 0),
      source: v.source === "tiktok" ? "tiktok" : "manual",
    }));

    return {
      id: prof.id,
      name: (prof.full_name as string | null)?.split(" ")[0] || "Créateur",
      badge: videos.some((v) => v.source === "tiktok") ? "connecte" : "manuel",
      videos,
      totals: {
        videos: videos.length,
        eligible_views: videos.reduce((a, v) => a + v.eligible_views, 0),
      },
    };
  });
