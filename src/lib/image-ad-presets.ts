/**
 * Styles de la création image de l'espace vendeur.
 * Chaque style ouvre un formulaire : Description, Langue, Format, Nombre d'images.
 * Si `withPerson` est vrai, le formulaire ajoute les réglages de la personne.
 */
export type ImageAdPreset = {
  key: string;
  title: string;
  desc: string;
  ideal: string;
  withPerson: boolean;
};

export const IMAGE_AD_PRESETS: ImageAdPreset[] = [
  {
    key: "creative-publicitaire",
    title: "Créative publicitaire",
    desc: "Ta photo devient des affiches prêtes à publier : l'accroche, les bénéfices, le bouton, et la légende qui vend.",
    ideal: "Facebook, Instagram, WhatsApp, tous les formats",
    withPerson: false,
  },
  {
    key: "ton-produit-en-main",
    title: "Ton produit en main",
    desc: "Une personne qui ressemble à tes clients tient ou utilise ton produit. Une photo qui fait vrai, sans texte.",
    ideal: "montrer le produit dans la vraie vie",
    withPerson: true,
  },
];
