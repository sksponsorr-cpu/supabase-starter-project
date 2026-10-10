import { createFileRoute } from "@tanstack/react-router";
import { AiToolPage } from "@/components/samflash/AiToolPage";

export const Route = createFileRoute("/clonage-video")({
  head: () => ({ meta: [{ title: "Clonage vidéo — Sam flash 2.0" }] }),
  component: () => (
    <AiToolPage
      tool="clone"
      title="Clonage vidéo"
      description="Donnez les mouvements d'une vidéo à un autre personnage à partir d'une image."
      mediaKind="video"
      mediaLabel="Ajouter la vidéo de mouvement"
      imageLabel="Ajouter l'image du personnage"
      promptPlaceholder="Ex. : le personnage danse dans un studio"
    />
  ),
});
