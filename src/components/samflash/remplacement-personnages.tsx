import { createFileRoute } from "@tanstack/react-router";
import { AiToolPage } from "@/components/samflash/AiToolPage";

export const Route = createFileRoute("/remplacement-personnages")({
  head: () => ({ meta: [{ title: "Remplacement de personnages — Sam Flash 2.0" }] }),
  component: () => (
    <AiToolPage
      openToAll
      tool="clone"
      title="Remplacer les personnages"
      description="Remplacez les personnages d'une vidéo par vos photos de référence, en conservant autant que possible la scène et les mouvements de la vidéo source."
      mediaKind="video"
      mediaLabel="Vidéo originale"
      imageLabel="Photo du personnage à intégrer"
      promptPlaceholder="Décrivez les personnages à remplacer. Précisez leur position dans la vidéo et indiquez que la scène, les mouvements et le rythme doivent rester fidèles à l'original."
    />
  ),
});
