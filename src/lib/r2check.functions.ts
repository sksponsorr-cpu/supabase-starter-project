import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";

export type R2Check = { label: string; ok: boolean; detail: string };

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

/** Teste réellement toute la chaîne Cloudflare R2 : variables, envoi, lecture publique. */
export const adminCheckR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<R2Check[]> => {
    await assertAdmin(context);
    const checks: R2Check[] = [];
    const env = (n: string) => (process.env[n] ?? "").trim();

    // 1. Variables présentes
    const names = ["BUCKET", "ENDPOINT", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "PUBLIC_URL"];
    const missing = names.filter((n) => !env(`CLOUDFLARE_R2_${n}`));
    checks.push({
      label: "Variables Cloudflare R2",
      ok: missing.length === 0,
      detail: missing.length === 0 ? "Les 5 variables sont présentes." : `Manquantes : ${missing.map((n) => "CLOUDFLARE_R2_" + n).join(", ")}`,
    });
    if (missing.length > 0) return checks;

    // 2. Format des adresses
    const publicUrl = env("CLOUDFLARE_R2_PUBLIC_URL");
    const endpoint = env("CLOUDFLARE_R2_ENDPOINT");
    const publicLooksPrivate = publicUrl.includes("r2.cloudflarestorage.com");
    checks.push({
      label: "CLOUDFLARE_R2_PUBLIC_URL",
      ok: publicUrl.startsWith("https://") && !publicLooksPrivate,
      detail: publicLooksPrivate
        ? "Cette adresse est l'endpoint privé (r2.cloudflarestorage.com). Il faut l'adresse publique : https://pub-xxxx.r2.dev ou votre domaine."
        : publicUrl.startsWith("https://")
          ? `Adresse : ${publicUrl}`
          : "Doit commencer par https://",
    });
    checks.push({
      label: "CLOUDFLARE_R2_ENDPOINT",
      ok: endpoint.startsWith("https://") && endpoint.includes("r2.cloudflarestorage.com"),
      detail: endpoint.includes("r2.cloudflarestorage.com")
        ? "Adresse d'endpoint correcte."
        : "Doit ressembler à https://<id-compte>.r2.cloudflarestorage.com",
    });

    // 3. Envoi réel d'un petit fichier
    const r2 = await import("@/lib/services/r2.server");
    let url = "";
    try {
      url = await r2.uploadToR2(
        "_diagnostic/test.txt",
        new TextEncoder().encode("sam-flash r2 ok"),
        "text/plain",
      );
      checks.push({ label: "Envoi vers R2", ok: true, detail: "Le fichier de test a bien été enregistré." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      checks.push({
        label: "Envoi vers R2",
        ok: false,
        detail: `${msg}. Erreur 403 = clés incorrectes ou droits insuffisants (il faut « Object Read & Write »). 404 = nom du bucket incorrect.`,
      });
      return checks;
    }

    // 4. Lecture publique
    try {
      const res = await fetch(url, { cache: "no-store" });
      const body = res.ok ? (await res.text()).trim() : "";
      checks.push({
        label: "Accès public au fichier",
        ok: res.ok && body === "sam-flash r2 ok",
        detail: res.ok
          ? "Le fichier est lisible publiquement."
          : `Réponse ${res.status} sur ${url}. Activez l'accès public du bucket (Settings > Public access) et vérifiez CLOUDFLARE_R2_PUBLIC_URL.`,
      });
    } catch {
      checks.push({
        label: "Accès public au fichier",
        ok: false,
        detail: `Adresse injoignable : ${url}. Vérifiez CLOUDFLARE_R2_PUBLIC_URL.`,
      });
    }
    return checks;
  });
