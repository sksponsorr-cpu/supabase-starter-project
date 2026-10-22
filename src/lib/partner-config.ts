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

/** Idées de contenu : présenter Sam Flash et ce que l'outil permet, sans obligation de créer une vidéo. */
export const PARTNER_INSPIRATIONS: { title: string; format: string; idea: string; hook: string }[] = [
  {
    title: "Ce que Sam Flash permet de faire",
    format: "Vidéo · 30 s",
    idea: "Présentez l'outil en trois usages concrets : un visuel produit, une publicité, une image pour les réseaux. Montrez l'écran, pas besoin de créer quoi que ce soit en direct.",
    hook: "Trois choses que je fais maintenant avec une seule application.",
  },
  {
    title: "Une semaine sans photographe",
    format: "Carrousel · 5 slides",
    idea: "Expliquez comment un petit commerçant peut préparer ses visuels de la semaine avec Sam Flash, slide après slide : besoin, outil, résultat.",
    hook: "Plus besoin de payer un photographe pour chaque produit.",
  },
  {
    title: "Pourquoi j'ai choisi Sam Flash",
    format: "Vidéo face caméra · 45 s",
    idea: "Racontez votre expérience personnelle : le problème que vous aviez, ce que vous avez découvert, ce qui vous a convaincu. Restez honnête sur ce que vous avez réellement testé.",
    hook: "Je voulais des visuels pro sans budget pro. Voilà ce que j'ai trouvé.",
  },
  {
    title: "Comparer les modèles disponibles",
    format: "Image · 4:5",
    idea: "Présentez les différents modèles proposés dans Sam Flash (images, vidéos) et à quoi chacun sert, en une phrase par modèle. Aidez l'abonné à choisir.",
    hook: "Un seul outil, plusieurs modèles. Voici à quoi servent-ils.",
  },
  {
    title: "Le coût affiché avant de créer",
    format: "Vidéo · 20 s",
    idea: "Montrez que le coût d'une création est affiché avant de la lancer, et expliquez simplement la différence entre une image et une vidéo.",
    hook: "Je sais combien je dépense avant de cliquer. C'est ça qui me rassure.",
  },
  {
    title: "Idées pour vos réseaux",
    format: "Post · texte + image",
    idea: "Listez cinq types de contenus que l'on peut préparer avec Sam Flash : affiche de promo, visuel de produit, fond pour story, miniature, illustration de blog.",
    hook: "Cinq contenus à préparer en une après-midi.",
  },
];
