import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Project = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title?: string }) => ({ title: input?.title }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        user_id: userId,
        title: data.title?.trim() || "Nouveau projet",
      })
      .select("id")
      .single();

    if (error || !project) {
      throw new Error(error?.message || "Erreur lors de la création du projet");
    }

    return project.id;
  });

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("projects")
      .select("id, title, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data as Project[];
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Identifiant manquant");
    return { id: String(input.id) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }

    return { ok: true };
  });


export const updateProjectTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; title: string }) => {
    if (!input?.id || !input?.title) throw new Error("Identifiant ou titre manquant");
    return { id: String(input.id), title: String(input.title) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("projects")
      .update({ title: data.title.trim() })
      .eq("id", data.id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
