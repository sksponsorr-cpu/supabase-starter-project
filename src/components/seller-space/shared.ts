import { supabase } from "@/integrations/supabase/client";

/** Client navigateur : les lectures passent par la sécurité RLS (chaque vendeur ne voit que ses données). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;

export const CATEGORIES = [
  "Mode & vêtements",
  "Beauté & santé",
  "Alimentation",
  "Électronique",
  "Maison & décoration",
  "Services",
  "Produits numériques",
  "Autre",
] as const;

export const ORDER_STATUSES = ["nouvelle", "confirmée", "en livraison", "livrée", "annulée"] as const;

export const field = "w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-600";

export function shopLink(userId: string) {
  return `${window.location.origin}/magasin?id=${userId}`;
}

export function trackingLink(orderId: string) {
  return `${window.location.origin}/suivi-commande?id=${orderId}`;
}

/** Envoie une image vers notre stockage et renvoie son adresse publique. */
export async function uploadImage(
  file: File,
  presign: (args: { data: { kind: "image"; type: string; size: number } }) => Promise<any>,
) {
  const res = await presign({ data: { kind: "image", type: file.type, size: file.size } });
  if (!res.ok) throw new Error(res.message ?? "Import impossible.");
  const put = await fetch(res.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!put.ok) throw new Error("Import impossible. Réessaie.");
  return res.publicUrl as string;
}
