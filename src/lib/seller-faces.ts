/**
 * Bibliothèque de visages du mode vendeur.
 * AJOUTER UNE PERSONNE : uniquement avec son accord écrit. Mettre la photo dans
 * public/faces/ et ajouter une ligne ci-dessous. Aucune photo trouvée sur internet.
 */
export type SellerFace = {
  id: string;
  src: string;
  label: string;
  genre: "femme" | "homme";
  age: "jeune" | "adulte" | "senior";
  lieu: "interieur" | "exterieur";
};

export const SELLER_FACES: SellerFace[] = [
  // Exemple : { id: "f1", src: "/faces/f1.jpg", label: "Personnage 1", genre: "femme", age: "adulte", lieu: "interieur" },
];
