import { createFileRoute } from "@tanstack/react-router";

function back(origin: string, status: string): Response {
  return new Response(null, { status: 302, headers: { Location: `${origin}/monetise?tiktok=${status}` } });
}

export const Route = createFileRoute("/api/public/tiktok/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { resolvePublicOrigin } = await import("@/lib/public-origin.server");
        const origin = await resolvePublicOrigin();
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (url.searchParams.get("error") || !code || !state) return back(origin, "refused");

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const db = supabaseAdmin as any;
          const { data: st } = await db.from("tiktok_oauth_states").select("user_id, created_at").eq("state", state).maybeSingle();
          await db.from("tiktok_oauth_states").delete().eq("state", state);
          if (!st || Date.now() - new Date(st.created_at).getTime() > 15 * 60 * 1000) return back(origin, "expired");

          const { exchangeCode, fetchDisplayName } = await import("@/lib/tiktok.server");
          const tokens = await exchangeCode(code);
          const name = await fetchDisplayName(tokens.access_token);

          // Un compte TikTok ne peut être lié qu'à un seul compte Sam Flash.
          const { data: other } = await db.from("creator_tiktok_accounts").select("user_id").eq("open_id", tokens.open_id).maybeSingle();
          if (other && other.user_id !== st.user_id) return back(origin, "used");

          const now = Date.now();
          const { error } = await db.from("creator_tiktok_accounts").upsert(
            {
              user_id: st.user_id,
              open_id: tokens.open_id,
              display_name: name,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              access_expires_at: new Date(now + tokens.expires_in * 1000).toISOString(),
              refresh_expires_at: new Date(now + tokens.refresh_expires_in * 1000).toISOString(),
              connected_at: new Date(now).toISOString(),
              last_sync_at: null,
            },
            { onConflict: "user_id" },
          );
          if (error) return back(origin, "error");
          return back(origin, "connected");
        } catch {
          return back(origin, "error");
        }
      },
    },
  },
});
