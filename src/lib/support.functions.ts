import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SupportMessage = {
  id: string;
  user_id: string;
  email: string | null;
  subject: string;
  body: string;
  status: string;
  created_at: string;
};

export type SupportReply = {
  id: string;
  message_id: string;
  author_id: string;
  is_staff: boolean;
  body: string;
  created_at: string;
};

/** Envoie un message au support (client). */
export const createSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { subject: string; body: string }) =>
    z.object({ subject: z.string().min(3).max(140), body: z.string().min(5).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Anti-spam : 5 messages max par heure et par utilisateur
    const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count, error: countError } = await context.supabase
      .from("support_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", oneHourAgo);

    if (!countError && typeof count === "number" && count >= 5) {
      return {
        ok: false as const,
        message:
          "Vous avez atteint la limite de 5 messages par heure. Veuillez patienter avant de recontacter le support.",
      };
    }

    const email = typeof context.claims["email"] === "string" ? context.claims["email"] : null;
    const now = new Date().toISOString();

    const { error } = await context.supabase.from("support_messages").insert({
      user_id: context.userId,
      email,
      subject: data.subject.trim(),
      body: data.body.trim(),
    });
    if (error) return { ok: false as const, message: "Envoi impossible." };

    // Envoi de l'email de notification au support (asynchrone sans bloquer)
    try {
      const { sendSupportNewMessageEmail } = await import("@/lib/services/brevo.server");
      await sendSupportNewMessageEmail({
        userEmail: email,
        requestType: data.subject.trim(),
        messageBody: data.body.trim(),
        createdAt: now,
      });
    } catch (emailErr) {
      console.error("[SUPPORT] Échec de l'envoi de l'email de notification support:", emailErr);
    }

    return { ok: true as const, message: "Message envoyé au support." };
  });

/** Messages visibles par l'appelant : les siens, ou tous s'il est admin/support. */
export const listSupportMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SupportMessage[]> => {
    const { data } = await context.supabase
      .from("support_messages")
      .select("id, user_id, email, subject, body, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []) as SupportMessage[];
  });

/** Réponses d'un fil de support. */
export const listSupportReplies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messageId: string }) =>
    z.object({ messageId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<SupportReply[]> => {
    const { data: rows } = await context.supabase
      .from("support_replies")
      .select("id, message_id, author_id, is_staff, body, created_at")
      .eq("message_id", data.messageId)
      .order("created_at", { ascending: true });
    return (rows ?? []) as SupportReply[];
  });

/** Répond à un fil de support. */
export const replyToSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messageId: string; body: string }) =>
    z.object({ messageId: z.string().uuid(), body: z.string().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: staff } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "support",
    });
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const isStaff = staff === true || admin === true;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticket } = await supabaseAdmin
      .from("support_messages")
      .select("id, user_id, email, subject, body")
      .eq("id", data.messageId)
      .maybeSingle();

    if (!ticket) {
      return { ok: false as const, message: "Ticket introuvable." };
    }

    // Si ce n'est pas un membre du support/admin, vérifier les règles utilisateur
    if (!isStaff) {
      // 1. Vérification que le ticket appartient bien à l'utilisateur
      if (ticket.user_id !== context.userId) {
        return { ok: false as const, message: "Action non autorisée." };
      }

      // 2. Anti-spam : 10 messages de suivi max par heure et par utilisateur
      const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
      const { count, error: countError } = await context.supabase
        .from("support_replies")
        .select("id", { count: "exact", head: true })
        .eq("author_id", context.userId)
        .gte("created_at", oneHourAgo);

      if (!countError && typeof count === "number" && count >= 10) {
        return {
          ok: false as const,
          message:
            "Vous avez atteint la limite de 10 messages de suivi par heure. Veuillez patienter avant d'envoyer un nouveau message.",
        };
      }
    }

    const { error } = await context.supabase.from("support_replies").insert({
      message_id: data.messageId,
      author_id: context.userId,
      is_staff: isStaff,
      body: data.body.trim(),
    });
    if (error) return { ok: false as const, message: "Réponse impossible." };

    if (isStaff) {
      await context.supabase
        .from("support_messages")
        .update({ status: "repondu" })
        .eq("id", data.messageId);

      // Notification email au client ayant ouvert le ticket
      try {
        let recipientEmail = ticket.email;
        if (!recipientEmail && ticket.user_id) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("email")
            .eq("id", ticket.user_id)
            .maybeSingle();
          recipientEmail = profile?.email ?? null;
        }

        if (recipientEmail) {
          const { sendSupportReplyEmail } = await import("@/lib/services/brevo.server");
          await sendSupportReplyEmail({
            toEmail: recipientEmail,
            originalSubject: ticket.subject ?? "Votre demande",
            originalBody: ticket.body ?? "",
            replyBody: data.body.trim(),
          });
        }
      } catch (replyErr) {
        console.error("[SUPPORT] Échec de l'envoi de l'email de réponse client:", replyErr);
      }
    } else {
      // Notification email au support lors d'un message de suivi client
      try {
        const userEmail =
          typeof context.claims["email"] === "string" ? context.claims["email"] : ticket.email;
        const { sendSupportFollowUpEmail } = await import("@/lib/services/brevo.server");
        await sendSupportFollowUpEmail({
          userEmail,
          ticketSubject: ticket.subject,
          messageBody: data.body.trim(),
          createdAt: new Date().toISOString(),
        });
      } catch (followUpErr) {
        console.error("[SUPPORT] Échec de l'envoi de l'email de suivi au support:", followUpErr);
      }
    }

    return { ok: true as const, message: "Réponse envoyée." };
  });

/** Change le statut d'un fil (staff). */
export const updateSupportStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messageId: string; status: string }) =>
    z
      .object({
        messageId: z.string().uuid(),
        status: z.enum(["ouvert", "repondu", "resolu"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("support_messages")
      .update({ status: data.status })
      .eq("id", data.messageId);
    if (error) return { ok: false as const, message: "Mise à jour impossible." };
    return { ok: true as const, message: "Statut mis à jour." };
  });

export type SupportUpdate = {
  ticketId: string;
  subject: string;
  replyId: string;
  body: string;
  createdAt: string;
};

/** Dernières réponses de l'équipe support sur les tickets de l'utilisateur connecté. */
export const listSupportUpdates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SupportUpdate[]> => {
    const { data: mine } = await context.supabase
      .from("support_messages")
      .select("id, subject")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    const tickets = mine ?? [];
    if (tickets.length === 0) return [];

    const { data: rows } = await context.supabase
      .from("support_replies")
      .select("id, message_id, body, created_at, is_staff")
      .in(
        "message_id",
        tickets.map((t) => t.id),
      )
      .eq("is_staff", true)
      .order("created_at", { ascending: false })
      .limit(30);

    return (rows ?? []).map((r) => ({
      ticketId: r.message_id,
      subject: tickets.find((t) => t.id === r.message_id)?.subject ?? "votre ticket",
      replyId: r.id,
      body: r.body,
      createdAt: r.created_at,
    }));
  });
