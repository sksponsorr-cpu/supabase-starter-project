import { createHash, randomBytes } from "node:crypto";

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Clé en clair, affichée une seule fois à l'utilisateur. */
export function newApiKey(): string {
  return `sfk_${randomBytes(32).toString("base64url")}`;
}

/** Retourne l'identifiant de l'utilisateur si la clé est valide et non révoquée, sinon null. */
export async function verifyApiKey(key: string): Promise<string | null> {
  if (!key.startsWith("sfk_")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const { data } = await db
    .from("api_keys")
    .select("id, user_id")
    .eq("key_hash", hashKey(key))
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return null;
  void db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data.user_id as string;
}
