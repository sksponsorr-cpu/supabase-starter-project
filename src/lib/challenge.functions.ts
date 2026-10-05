import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";
import { z } from "zod";

export const CHALLENGE_MIN_VIEWS = 5000;
export const CHALLENGE_WINDOW_DAYS = 3;

export type PromoDemo = {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  active: boolean;
};

export type MySubmission = {
  id: string;
  video_url: string;
  platform: string;
  published_at: string;
  claimed_views: number;
  status: string;
  reject_reason: string | null;
  created_at: string;
};

export type AiVerdict = {
  views_visible: number | null;
  matches_claim: boolean | null;
  suspicious: boolean;
  signs: string[];
  summary: string;
};

export type AdminSubmission = MySubmission & {
  user_id: string;
  user_email: string | null;
  demo_title: string | null;
  screenshot_url: string | null;
  stats_url: string | null;
  ai_verdict: AiVerdict | null;
};

const ALLOWED_HOSTS: Record<string, string> = {
  "tiktok.com": "TikTok",
  "youtube.com": "YouTube",
  "youtu.be": "YouTube",
};

function platformFor(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "").replace(/^vm\./, "");
    for (const [domain, name] of Object.entries(ALLOWED_HOSTS)) {
      if (host === domain || host.endsWith("." + domain)) return name;
    }
  } catch {
    /* url invalide */
  }
  return null;
}

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

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/* ------------------------------ Utilisateur ------------------------------ */

export const listDemos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<PromoDemo[]> => {
    const db = await adminDb();
    const { data } = await db
      .from("promo_demos")
      .select("id, title, description, video_url, active")
      .eq("active", true)
      .order("created_at", { ascending: false });
    return (data ?? []) as PromoDemo[];
  });

export const listMySubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MySubmission[]> => {
    const db = await adminDb();
    const { data } = await db
      .from("promo_submissions")
      .select("id, video_url, platform, published_at, claimed_views, status, reject_reason, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    return (data ?? []) as MySubmission[];
  });

export const submitChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    videoUrl: string;
    demoId: string | null;
    publishedAt: string;
    claimedViews: number;
    screenshotPath: string;
    statsPath: string;
  }) =>
    z
      .object({
        videoUrl: z.string().trim().url().max(500),
        demoId: z.string().uuid().nullable(),
        publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        claimedViews: z.number().int().min(0).max(1_000_000_000),
        screenshotPath: z.string().min(5).max(300),
        statsPath: z.string().min(5).max(300),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean; message: string }> => {
    const platform = platformFor(data.videoUrl);
    if (!data.videoUrl.startsWith("https://") || !platform) {
      return { ok: false, message: "Lien non reconnu. Utilisez un lien TikTok ou YouTube." };
    }
    if (data.claimedViews < CHALLENGE_MIN_VIEWS) {
      return { ok: false, message: `Il faut au moins ${CHALLENGE_MIN_VIEWS} vues pour participer.` };
    }
    const published = new Date(data.publishedAt + "T00:00:00Z");
    const now = new Date();
    if (Number.isNaN(published.getTime()) || published > now) {
      return { ok: false, message: "Date de publication invalide." };
    }
    if ((now.getTime() - published.getTime()) / 86400000 > 45) {
      return { ok: false, message: "Cette vidéo est trop ancienne pour participer." };
    }
    const prefix = `${context.userId}/`;
    if (!data.screenshotPath.startsWith(prefix) || !data.statsPath.startsWith(prefix)) {
      return { ok: false, message: "Captures d'écran invalides." };
    }

    const db = await adminDb();
    const { count } = await db
      .from("promo_submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("status", "pending");
    if ((count ?? 0) >= 3) {
      return { ok: false, message: "Vous avez déjà 3 demandes en attente. Patientez le temps qu'elles soient traitées." };
    }

    const { error } = await db.from("promo_submissions").insert({
      user_id: context.userId,
      demo_id: data.demoId,
      video_url: data.videoUrl,
      platform,
      published_at: data.publishedAt,
      claimed_views: data.claimedViews,
      screenshot_path: data.screenshotPath,
      stats_path: data.statsPath,
    });
    if (error) {
      if (String(error.code) === "23505") {
        return { ok: false, message: "Cette vidéo a déjà été soumise." };
      }
      return { ok: false, message: "Envoi impossible, réessayez." };
    }
    return { ok: true, message: "Demande envoyée ! Nous la vérifions rapidement." };
  });

/* -------------------------------- Admin ---------------------------------- */

export const adminListSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status: "pending" | "approved" | "rejected" }) =>
    z.object({ status: z.enum(["pending", "approved", "rejected"]) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<AdminSubmission[]> => {
    await assertAdmin(context);
    const db = await adminDb();
    const { data: rows } = await db
      .from("promo_submissions")
      .select("*")
      .eq("status", data.status)
      .order("created_at", { ascending: data.status === "pending" })
      .limit(50);
    const list = (rows ?? []) as any[];
    if (list.length === 0) return [];

    const userIds = [...new Set(list.map((r) => r.user_id))];
    const demoIds = [...new Set(list.map((r) => r.demo_id).filter(Boolean))];
    const [{ data: profiles }, { data: demos }] = await Promise.all([
      db.from("profiles").select("id, email").in("id", userIds),
      demoIds.length ? db.from("promo_demos").select("id, title").in("id", demoIds) : Promise.resolve({ data: [] }),
    ]);

    const sign = async (path: string) => {
      const { data } = await db.storage.from("promo-proofs").createSignedUrl(path, 3600);
      return data?.signedUrl ?? null;
    };

    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
    const demoMap = Object.fromEntries((demos ?? []).map((d) => [d.id, d]));

    return Promise.all(
      list.map(async (r) => {
        const prof = profileMap[r.user_id];
        const demo = demoMap[r.demo_id];
        const [screenshot_url, stats_url] = await Promise.all([
          sign(r.screenshot_path),
          sign(r.stats_path),
        ]);
        return {
          ...r,
          user_email: prof?.email,
          demo_title: demo?.title,
          screenshot_url,
          stats_url,
        };
      }),
    );
  });

/** Analyse indicative de la capture de statistiques par une IA (jamais de rejet automatique). */
export const adminAnalyzeSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: boolean; message: string; verdict?: AiVerdict }> => {
    await assertAdmin(context);
    const key = process.env["OPENROUTER_API_KEY"];
    if (!key) return { ok: false, message: "Analyse IA indisponible (clé OpenRouter manquante)." };

    const db = await adminDb();
    const { data: row } = await db.from("promo_submissions").select("*").eq("id", data.id).maybeSingle();
    if (!row) return { ok: false, message: "Demande introuvable." };

    const { data: file, error: dlError } = await db.storage.from("promo-proofs").download(row.stats_path);
    if (dlError || !file) return { ok: false, message: "Capture introuvable." };
    const bytes = new Uint8Array(await (file as Blob).arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const mime = (file as Blob).type || "image/jpeg";
    const dataUrl = `data:${mime};base64,${btoa(binary)}`;

    const prompt =
      `Tu aides un modérateur à vérifier une capture d'écran de statistiques d'une vidéo ${row.platform}. ` +
      `L'utilisateur affirme : ${row.claimed_views} vues, vidéo publiée le ${row.published_at}. ` +
      `Analyse l'image et réponds UNIQUEMENT avec un objet JSON : ` +
      `{"views_visible": nombre ou null, "matches_claim": true/false/null, "suspicious": true/false, ` +
      `"signs": [indices concrets de retouche ou d'incohérence : polices différentes, alignement, chiffres incohérents, interface inhabituelle, etc.], ` +
      `"summary": "une phrase en français"}. Sois prudent : ne conclus pas à la fraude sans indice concret.`;

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env["OPENROUTER_VISION_MODEL"] ?? "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      });
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
      const text = json.choices?.[0]?.message?.content ?? "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!res.ok || !match) {
        return { ok: false, message: json.error?.message ?? "Réponse IA inexploitable." };
      }
      const parsed = JSON.parse(match[0]) as Partial<AiVerdict>;
      const verdict: AiVerdict = {
        views_visible: typeof parsed.views_visible === "number" ? parsed.views_visible : null,
        matches_claim: typeof parsed.matches_claim === "boolean" ? parsed.matches_claim : null,
        suspicious: Boolean(parsed.suspicious),
        signs: Array.isArray(parsed.signs) ? parsed.signs.map(String).slice(0, 8) : [],
        summary: String(parsed.summary ?? "").slice(0, 400),
      };
      await db.from("promo_submissions").update({ ai_verdict: verdict }).eq("id", data.id);
      return { ok: true, message: "Analyse terminée.", verdict };
    } catch {
      return { ok: false, message: "Analyse IA impossible pour le moment." };
    }
  });

/** Accepte ou refuse. L'acceptation offre 1 mois d'abonnement (prolongé si déjà abonné). */
export const adminReviewSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; decision: "approve" | "reject"; reason?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        reason: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean; message: string }> => {
    await assertAdmin(context);
    const db = await adminDb();

    const { data: updated } = await db
      .from("promo_submissions")
      .update({
        status: data.decision === "approve" ? "approved" : "rejected",
        reject_reason: data.decision === "reject" ? (data.reason || "Preuves non conformes") : null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "pending")
      .select("id, user_id")
      .maybeSingle();

    if (!updated) return { ok: false, message: "Cette demande a déjà été traitée." };

    if (data.decision === "approve") {
      const nowIso = new Date().toISOString();
      const { data: existing } = await db
        .from("subscriptions")
        .select("id, ends_at, status, is_active")
        .eq("user_id", updated.user_id)
        .maybeSingle();

      const activeNow =
        !!existing &&
        existing.status === "active" &&
        existing.is_active !== false &&
        existing.ends_at &&
        new Date(existing.ends_at) > new Date();

      const base = activeNow ? new Date(existing.ends_at) : new Date();
      base.setMonth(base.getMonth() + 1);
      const endsAt = base.toISOString();

      if (existing && activeNow) {
        await db.from("subscriptions").update({ ends_at: endsAt }).eq("id", existing.id);
      } else if (existing) {
        await db
          .from("subscriptions")
          .update({
            tier: "super_grok",
            plan_type: "super_grok_monthly",
            status: "active",
            is_active: true,
            started_at: nowIso,
            ends_at: endsAt,
          })
          .eq("id", existing.id);
      } else {
        await db.from("subscriptions").insert({
          user_id: updated.user_id,
          tier: "super_grok",
          plan_type: "super_grok_monthly",
          status: "active",
          is_active: true,
          ends_at: endsAt,
        });
      }
    }

    await db.from("admin_actions").insert({
      admin_id: context.userId,
      target_user_id: updated.user_id,
      action: data.decision === "approve" ? "challenge_approved" : "challenge_rejected",
      details: { submission_id: data.id, reason: data.reason ?? null },
    });

    return {
      ok: true,
      message: data.decision === "approve" ? "Acceptée : 1 mois d'abonnement offert." : "Demande refusée.",
    };
  });

export const adminListDemos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PromoDemo[]> => {
    await assertAdmin(context);
    const db = await adminDb();
    const { data } = await db
      .from("promo_demos")
      .select("id, title, description, video_url, active")
      .order("created_at", { ascending: false });
    return (data ?? []) as PromoDemo[];
  });

export const adminSaveDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string; description: string; videoUrl: string }) =>
    z
      .object({
        title: z.string().trim().min(2).max(120),
        description: z.string().trim().max(400),
        videoUrl: z.string().trim().url().max(600),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    await assertAdmin(context);
    const db = await adminDb();
    const { error } = await db.from("promo_demos").insert({
      title: data.title,
      description: data.description || null,
      video_url: data.videoUrl,
    });
    return { ok: !error };
  });

export const adminUpdateDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; active?: boolean; remove?: boolean }) =>
    z.object({ id: z.string().uuid(), active: z.boolean().optional(), remove: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    await assertAdmin(context);
    const db = await adminDb();
    if (data.remove) {
      const { error } = await db.from("promo_demos").delete().eq("id", data.id);
      return { ok: !error };
    }
    const { error } = await db.from("promo_demos").update({ active: data.active ?? true }).eq("id", data.id);
    return { ok: !error };
  });
