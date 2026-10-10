import { createFileRoute } from "@tanstack/react-router";
import { AiToolPage } from "@/components/samflash/AiToolPage";

export const Route = createFileRoute("/avatar-ai")({
  head: () => ({ meta: [{ title: "Avatar AI — Sam flash 2.0" }] }),
  component: () => (
    <AiToolPage
      tool="avatar"
      title="Avatar AI"
      description="Transformez une photo et une voix en vidéo d'avatar qui parle."
      mediaKind="audio"
      mediaLabel="Ajouter l'audio de la voix"
      imageLabel="Ajouter la photo du visage"
      promptPlaceholder="Ex. : une femme qui parle devant un micro, expressions naturelles"
    />
  ),
});
