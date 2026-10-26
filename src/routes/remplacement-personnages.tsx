import { createFileRoute } from "@tanstack/react-router";
import { AiToolPage } from "@/components/samflash/AiToolPage";

export const Route = createFileRoute("/remplacement-personnages")({
  head: () => ({ meta: [{ title: "Remplacer les personnages — Sam flash 2.0" }] }),
  component: () => (
    <AiToolPage
      openToAll
      tool="clone"
      variantProvider="seedance"
      title="Remplacer les personnages"
      description="Gardez la scène, les mouvements et le rythme du modèle. Remplacez seulement les personnages par ceux de vos photos."
      mediaKind="video"
      mediaLabel="Vidéo de référence"
      imageLabel="Photo de la personne ou du produit"
      promptPlaceholder="Remplace les personnages par la personne de la photo, garde la même scène et les mêmes mouvements."
    />
  ),
});
