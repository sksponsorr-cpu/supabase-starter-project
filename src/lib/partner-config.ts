/** Programme partenaires : réglages partagés entre serveur et interface. */
export const PARTNER_COMMISSION_PERCENT = 25;
export const MIN_WITHDRAWAL_USD = 5;
/** Taux indicatif USD → EUR, pour exprimer le minimum de 5 $ en euros avant conversion locale. */
export const EUR_PER_USD_APPROX = 0.92;

export const PARTNER_SITE_URL = "https://sam-flash.lat";

/** Lien affilié public d'un partenaire, à partager tel quel. */
export function affiliateLink(code: string): string {
  return `${PARTNER_SITE_URL}/?ref=${encodeURIComponent(code)}`;
}

/** Idées de créations à proposer aux partenaires pour s'inspirer. */
export const PARTNER_INSPIRATIONS: { title: string; format: string; prompt: string }[] = [
  {
    title: "Produit en lumière douce",
    format: "Image · 1:1",
    prompt: "Photo produit minimaliste, lumière douce de fin de journée, fond beige, ombre portée subtile, style publicitaire haut de gamme",
  },
  {
    title: "Pub UGC dans la rue",
    format: "Vidéo · 9:16 · 6 s",
    prompt: "Une jeune femme tient le produit face caméra dans une rue animée, ton naturel et enthousiaste, mouvement de caméra à l'épaule",
  },
  {
    title: "Avant / après",
    format: "Image · 4:5",
    prompt: "Deux visuels côte à côte, à gauche le problème en tons ternes, à droite la solution en couleurs vives, composition claire et lisible",
  },
  {
    title: "Témoignage stylé",
    format: "Vidéo · 9:16 · 8 s",
    prompt: "Portrait d'une personne souriante qui recommande le produit, arrière-plan flou d'un salon moderne, lumière chaude",
  },
  {
    title: "Affiche de promotion",
    format: "Image · 3:4",
    prompt: "Affiche promotionnelle épurée, titre en grand, produit au centre, dégradé bleu et or, typographie moderne",
  },
  {
    title: "Mannequin portant le produit",
    format: "Image · 9:16",
    prompt: "Mannequin portant le produit dans un décor urbain, pose naturelle, éclairage studio doux, rendu photo professionnel",
  },
];
