/** Appels à l'API TikTok (Login Kit + Display API). Serveur uniquement. */
import { resolvePublicOrigin } from "@/lib/public-origin.server";

const env = (n: string) => (process.env[n] ?? "").trim();

export function tiktokConfigured(): boolean {
  return !!env("TIKTOK_CLIENT_KEY") && !!env("TIKTOK_CLIENT_SECRET");
}

export async function tiktokRedirectUri(): Promise<string> {
  return `${await resolvePublicOrigin()}/api/public/tiktok/callback`;
}

export async function buildAuthorizeUrl(state: string): Promise<string> {
  const q = new URLSearchParams({
    client_key: env("TIKTOK_CLIENT_KEY"),
    scope: "user.info.basic,video.list",
    response_type: "code",
    redirect_uri: await tiktokRedirectUri(),
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${q.toString()}`;
}

export type TiktokTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  open_id: string;
};

async function tokenRequest(params: Record<string, string>): Promise<TiktokTokens> {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: env("TIKTOK_CLIENT_KEY"), client_secret: env("TIKTOK_CLIENT_SECRET"), ...params }),
  });
  const json = (await res.json().catch(() => null)) as Partial<TiktokTokens> | null;
  if (!res.ok || !json?.access_token || !json.refresh_token || !json.open_id) throw new Error("tiktok_token");
  return json as TiktokTokens;
}

export async function exchangeCode(code: string): Promise<TiktokTokens> {
  return tokenRequest({ code, grant_type: "authorization_code", redirect_uri: await tiktokRedirectUri() });
}

export function refreshTokens(refreshToken: string): Promise<TiktokTokens> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function fetchDisplayName(accessToken: string): Promise<string | null> {
  const res = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json().catch(() => null)) as { data?: { user?: { display_name?: string } } } | null;
  return json?.data?.user?.display_name ?? null;
}

export type TiktokVideo = {
  id: string;
  title?: string;
  video_description?: string;
  create_time?: number;
  share_url?: string;
  view_count?: number;
};

/** Dernières vidéos publiques du créateur (jusqu'à 60), avec leur nombre de vues. */
export async function fetchVideos(accessToken: string): Promise<TiktokVideo[]> {
  const out: TiktokVideo[] = [];
  let cursor: number | undefined;
  for (let page = 0; page < 3; page++) {
    const res = await fetch(
      "https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,create_time,share_url,view_count",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ max_count: 20, ...(cursor ? { cursor } : {}) }),
      },
    );
    const json = (await res.json().catch(() => null)) as {
      data?: { videos?: TiktokVideo[]; has_more?: boolean; cursor?: number };
    } | null;
    if (!res.ok || !json?.data) throw new Error("tiktok_videos");
    out.push(...(json.data.videos ?? []));
    if (!json.data.has_more) break;
    cursor = json.data.cursor;
  }
  return out;
}
