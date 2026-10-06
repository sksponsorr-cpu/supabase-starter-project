import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupportMessage } from "@/lib/support.functions";

export type SupportInbox = {
  items: SupportMessage[];
  total: number;
  counts: { all: number; ouvert: number; repondu: number; resolu: number };
};

/** Boîte de support du bureau d'administration : pagination, filtre par statut, recherche. */
export const listSupportInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { offset?: number; limit?: number; status?: string; q?: string }) =>
    z
      .object({
        offset: z.number().int().min(0).max(100000).default(0),
        limit: z.number().int().min(1).max(50).default(10),
        status: z.enum(["all", "ouvert", "repondu", "resolu"]).default("all"),
        q: z.string().trim().max(80).default(""),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<SupportInbox> => {
    const db = context.supabase;

    let query = db
      .from("support_messages")
      .select("id, user_id, email, subject, body, status, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.status !== "all") query = query.eq("status", data.status);
    if (data.q) {
      // On retire les caractères spéciaux du filtre pour éviter toute injection de syntaxe.
      const safe = data.q.replace(/[%,()*\\]/g, " ").trim();
      if (safe) {
        query = query.or(`email.ilike.%${safe}%,subject.ilike.%${safe}%,body.ilike.%${safe}%`);
      }
    }
    const { data: rows, count } = await query;

    const countFor = async (status?: string) => {
      let q = db.from("support_messages").select("id", { count: "exact", head: true });
      if (status) q = q.eq("status", status);
      const { count: c } = await q;
      return c ?? 0;
    };
    const [all, ouvert, repondu, resolu] = await Promise.all([
      countFor(),
      countFor("ouvert"),
      countFor("repondu"),
      countFor("resolu"),
    ]);

    return {
      items: (rows ?? []) as SupportMessage[],
      total: count ?? 0,
      counts: { all, ouvert, repondu, resolu },
    };
  });
