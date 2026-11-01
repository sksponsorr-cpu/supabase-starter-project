/**
 * Ressources Sam Flash : contenu affiché dans l'onglet « Ressources ».
 * Accès : abonnés payants hors offre Light. Les autres voient un aperçu.
 * Ajoutez ou modifiez les entrées ici, sans toucher au composant.
 */

export type ResourceType = "formation" | "article" | "prompt" | "video" | "skill" | "niche" | "actu";

export interface Resource {
  id: string;
  type: ResourceType;
  title: string;
  summary: string;
  /** Contenu complet, visible seulement pour les abonnés autorisés. */
  body: string;
  /** Vrai : visible aussi pour les non-abonnés (aperçu). */
  preview: boolean;
}

export interface ResourceCategory {
  id: string;
  label: string;
  items: Resource[];
}

export const RESOURCE_CATEGORIES: ResourceCategory[] = [
  {
    id: "formations",
    label: "Formations",
    items: [
      {
        id: "form-demarrer",
        type: "formation",
        title: "Créer ta première vidéo IA en 20 minutes",
        summary: "De la première idée à la vidéo prête à publier, étape par étape.",
        body:
          "1. Choisis un sujet précis (un produit, un match, une annonce).\n" +
          "2. Écris ton prompt en 3 phrases : sujet, action, ambiance.\n" +
          "3. Lance une vidéo courte (6 secondes) pour tester.\n" +
          "4. Ajuste un seul élément à la fois : lumière, mouvement, cadrage.\n" +
          "5. Garde la version qui retient l'attention dans les deux premières secondes.",
        preview: true,
      },
      {
        id: "form-cinema",
        type: "formation",
        title: "Des plans cinématiques, sans caméra",
        summary: "Plans larges, travellings, lumière : les codes du cinéma dans tes prompts.",
        body:
          "Décris toujours : le type de plan (plan large, gros plan, travelling), " +
          "la lumière (contre-jour, lumière dorée, néon), la vitesse du mouvement (lent, nerveux) " +
          "et la palette de couleurs. Un plan réussi tient en une phrase précise.",
        preview: false,
      },
    ],
  },
  {
    id: "prompts",
    label: "Prompts vidéo",
    items: [
      {
        id: "prompt-cinema",
        type: "prompt",
        title: "Prompt : plan cinématique de nuit",
        summary: "Un plan de ville sous la pluie, prêt à copier.",
        body:
          "Plan large d'une rue de nuit sous la pluie, reflets néon sur le pavé mouillé, " +
          "travelling lent vers l'avant, lumière bleue et orange, ambiance de film noir, 6 secondes.",
        preview: true,
      },
      {
        id: "prompt-produit",
        type: "prompt",
        title: "Prompt : vidéo produit qui attire l'œil",
        summary: "Une publicité courte pour un produit, avec un mouvement qui arrête le scroll.",
        body:
          "Gros plan sur le produit posé sur une surface sombre, rotation lente de 360 degrés, " +
          "lumière douce qui glisse sur la matière, fond flou, style publicité haut de gamme, 6 secondes.",
        preview: false,
      },
    ],
  },
  {
    id: "viral",
    label: "Niches virales",
    items: [
      {
        id: "niche-football",
        type: "niche",
        title: "Niche football : les vidéos qui font réagir",
        summary: "Les formats qui marchent autour du football, et comment les décliner.",
        body:
          "Les formats qui retiennent l'attention : le « avant / après » d'un but, " +
          "la réaction en tribune, le duel de deux joueurs, la rétrospective en 6 secondes. " +
          "Garde un seul moment fort par vidéo et commence par l'action.",
        preview: true,
      },
      {
        id: "niche-ia",
        type: "niche",
        title: "Niche IA : montrer le résultat avant l'explication",
        summary: "Pourquoi les vidéos « avant / après IA » partagent plus que les tutoriels.",
        body:
          "Montre le résultat dans la première seconde, puis explique en une phrase comment tu l'as obtenu. " +
          "Les comparaisons visuelles et les démonstrations courtes sont les formats les plus partagés.",
        preview: false,
      },
    ],
  },
  {
    id: "actu",
    label: "Actualités des niches",
    items: [
      {
        id: "actu-semaine",
        type: "actu",
        title: "Ce qui marche cette semaine dans les niches",
        summary: "Le résumé des tendances à exploiter, mis à jour chaque semaine.",
        body:
          "Mise à jour hebdomadaire : tendances football et IA, formats qui montent, " +
          "idées de vidéos à lancer dès aujourd'hui. (À compléter chaque semaine.)",
        preview: true,
      },
    ],
  },
  {
    id: "skills",
    label: "Compétences",
    items: [
      {
        id: "skill-storyboard",
        type: "skill",
        title: "Compétence : écrire un storyboard en 3 plans",
        summary: "Structurer une vidéo courte avant de la générer.",
        body:
          "Plan 1 : l'accroche (2 secondes). Plan 2 : le moment fort. Plan 3 : la fin marquante " +
          "ou l'appel à l'action. Un prompt par plan, un mouvement par plan.",
        preview: false,
      },
    ],
  },
];

/** Accès complet : abonné payant, hors offre Light. */
export function hasResourceAccess(planType: string | null | undefined): boolean {
  return !!planType && planType !== "free" && planType !== "sam_flash_light";
}
