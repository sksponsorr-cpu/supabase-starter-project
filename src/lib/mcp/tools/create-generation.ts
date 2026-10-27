import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_generation",
  title: "Créer une génération",
  description:
    "Enregistre seulement une demande de génération dans l'historique du compte. Ne lance PAS la génération et ne débite PAS de crédits : pour générer, utiliser le serveur d'API (generate_video).",
  inputSchema: {
    prompt: z.string().trim().describe("Description de l'image ou de la vidéo à créer."),
    media_type: z.enum(["image", "video"]).describe("Type de média demandé."),
    resolution: z.enum(["480p", "720p", "1080p"]).optional().describe("Résolution souhaitée."),
    duration: z.enum(["4s", "5s", "6s", "8s", "10s", "15s", "20s", "30s"]).optional().describe("Durée pour une vidéo."),
    aspect_ratio: z.enum(["9:16", "2:3", "3:4", "1:1", "16:9"]).optional().describe("Format d'image."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié." }], isError: true };
    }
    if (!input.prompt) {
      return { content: [{ type: "text", text: "Le prompt est vide." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("generations")
      .insert({
        user_id: ctx.getUserId(),
        prompt: input.prompt,
        media_type: input.media_type,
        resolution: input.resolution ?? "720p",
        duration: input.duration ?? (input.media_type === "video" ? "6s" : null),
        aspect_ratio: input.aspect_ratio ?? "2:3",
      })
      .select()
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { generation: data },
    };
  },
});
