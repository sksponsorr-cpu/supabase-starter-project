import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type TeamRole = "admin" | "moderator" | "support" | "finance" | "developer";

export type TeamMember = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  roles: TeamRole[];
};

export type TeamInvitation = {
  id: string;
  email: string;
  role: TeamRole;
  accepted_at: string | null;
  created_at: string;
};

const roleSchema = z.enum(["admin", "moderator", "support", "finance", "developer"]);

const ROLE_LABEL: Record<TeamRole, string> = {
  admin: "Administrateur",
  moderator: "Modérateur",
  support: "Support",
  finance: "Finance",
  developer: "Développeur",
};

/** Membres de l'équipe (comptes existants disposant d'un rôle). */
export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TeamMember[]> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) throw new Error("Accès refusé");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: roles }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("profiles").select("id, email, full_name"),
    ]);

    const byUser = new Map<string, TeamMember>();
    for (const r of roles ?? []) {
      if (r.role === "user") continue;
      const profile = (profiles ?? []).find((p) => p.id === r.user_id);
      const entry = byUser.get(r.user_id) ?? {
        user_id: r.user_id,
        email: profile?.email ?? null,
        full_name: profile?.full_name ?? null,
        roles: [],
      };
      entry.roles.push(r.role as TeamRole);
      byUser.set(r.user_id, entry);
    }
    return [...byUser.values()];
  });

/** Invitations envoyées (rôle appliqué automatiquement à l'inscription). */
export const listInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TeamInvitation[]> => {
    const { data } = await context.supabase
      .from("team_invitations")
      .select("id, email, role, accepted_at, created_at")
      .order("created_at", { ascending: false });
    return (data ?? []) as TeamInvitation[];
  });

/** Invite un collaborateur : le rôle est attribué dès sa première connexion. */
export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; role: TeamRole }) =>
    z.object({ email: z.string().email().max(160), role: roleSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true)
      return { ok: false as const, message: "Accès refusé.", inviteLink: null as string | null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: existing.id, role: data.role }, { onConflict: "user_id,role" });
      if (error)
        return { ok: false as const, message: "Attribution du rôle impossible.", inviteLink: null };
      return {
        ok: true as const,
        message: "Rôle attribué au compte existant.",
        inviteLink: null,
      };
    }

    const { error } = await context.supabase
      .from("team_invitations")
      .insert({ email, role: data.role, invited_by: context.userId });
    if (error) return { ok: false as const, message: "Invitation impossible.", inviteLink: null };

    const { resolvePublicOrigin } = await import("@/lib/public-origin.server");
    const origin = await resolvePublicOrigin();
    const redirectTo = `${origin}/?next=/admin`;
    const roleLabel = ROLE_LABEL[data.role];

    // 1) Lien d'invitation officiel (crée le compte côté Supabase Auth).
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo, data: { team_role: data.role } },
    });
    const inviteLink = linkData?.properties?.action_link ?? null;

    if (linkError || !inviteLink) {
      await supabaseAdmin
        .from("team_invitations")
        .delete()
        .eq("email", email)
        .eq("role", data.role)
        .is("accepted_at", null);
      return {
        ok: false as const,
        message: `Invitation impossible : ${linkError?.message ?? "lien d'accès non généré"}.`,
        inviteLink: null,
      };
    }

    // 2) Envoi de l'e-mail : Resend si configuré, sinon SMTP Supabase.
    const { hasResend, sendEmail, invitationHtml } = await import("@/lib/email.server");
    if (hasResend()) {
      const sent = await sendEmail({
        to: email,
        subject: "Votre invitation Sam flash 2.0",
        html: invitationHtml(inviteLink, roleLabel),
      });
      if (sent.ok) return { ok: true as const, message: "Invitation envoyée par e-mail.", inviteLink };
      return {
        ok: true as const,
        message: `${sent.message ?? "E-mail non envoyé."} Partagez le lien d'accès ci-dessous.`,
        inviteLink,
      };
    }

    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { team_role: data.role },
    });
    if (inviteError) {
      return {
        ok: true as const,
        message:
          "L’e-mail automatique n’a pas pu partir (service d’e-mail non configuré). Partagez le lien d’accès ci-dessous.",
        inviteLink,
      };
    }

    return { ok: true as const, message: "Invitation envoyée par e-mail.", inviteLink };
  });

/** Retire un rôle à un collaborateur. */
export const revokeTeamRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: TeamRole }) =>
    z.object({ userId: z.string().uuid(), role: roleSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) return { ok: false as const, message: "Accès refusé." };
    if (data.userId === context.userId && data.role === "admin")
      return { ok: false as const, message: "Vous ne pouvez pas retirer votre propre accès admin." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) return { ok: false as const, message: "Retrait impossible." };
    return { ok: true as const, message: "Rôle retiré." };
  });

/** Annule une invitation non acceptée. */
export const cancelInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("team_invitations")
      .delete()
      .eq("id", data.id)
      .is("accepted_at", null);
    if (error) return { ok: false as const, message: "Annulation impossible." };
    return { ok: true as const, message: "Invitation annulée." };
  });
