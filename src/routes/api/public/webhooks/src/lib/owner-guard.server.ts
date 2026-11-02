import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isOwnerEmail } from "@/lib/owners";

/** Vrai si l'utilisateur est propriétaire de la plateforme ou admin. Côté serveur uniquement. */
export async function isPlatformOwner(userId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const { data } = await db.auth.admin.getUserById(userId);
  if (isOwnerEmail(data?.user?.email)) return true;
  const { data: prof } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  return prof?.role === "admin";
}
