import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hashKey, newApiKey } from "@/lib/mcp/api-keys.server";

/** Liste les clés de l'utilisateur connecté (sans la clé en clair). */
export const listMcpKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data, error } = await db
      .from("api_keys")
      .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Impossible de charger les clés.");
    return { keys: data ?? [] };
  });

/** Crée une clé. La clé en clair n'est renvoyée qu'ici. */
export const createMcpKey = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const name = typeof (input as { name?: unknown })?.name === "string" ? (input as { name: string }).name.trim() : "";
    return { name: (name || "Ma clé").slice(0, 60) };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const key = newApiKey();
    const { error } = await db.from("api_keys").insert({
      user_id: context.userId,
      name: data.name,
      key_prefix: key.slice(0, 10),
      key_hash: hashKey(key),
    });
    if (error) throw new Error("Impossible de créer la clé.");
    return { key };
  });

/** Révoque une clé de l'utilisateur. */
export const revokeMcpKey = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const id = (input as { id?: unknown })?.id;
    if (typeof id !== "string" || id.length > 64) throw new Error("Identifiant invalide.");
    return { id };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { error } = await db
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("Impossible de révoquer la clé.");
    return { ok: true };
  });
