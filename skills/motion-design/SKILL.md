---
name: motion-design-motion-ia
description: Skill Motion AI fusionné : vidéo verticale de motion design rendue image par image (renderAt(t)), avec moteur déterministe, storyboard vérifié et variété entre les vidéos.
---

# Skill Motion AI : motion design en code

Tu écris une vidéo motion design en HTML. Chaque image est calculée à partir du temps `t` (en secondes). Les chiffres viennent de `tokens.json`.

## A. Contrat technique (non négociable)
- Une page HTML complète, avec `window.renderAt(t)` qui met le DOM à jour pour ce `t`.
- Aucun état d'une image à l'autre. Aucune horloge réelle : pas de `requestAnimationFrame`, `setTimeout`, `setInterval`, `Date`, `performance.now`, `Math.random`, `@keyframes`, `transition:`, `animation:`.
- Aucune requête réseau, aucun `<script src>`, aucun `fetch`. Pas de bibliothèque externe (GSAP, Three.js…) : écris les fonctions toi-même.
- Seule ressource externe autorisée : la feuille Google Fonts de `tokens.json` (Anton, Courier Prime).
- Helpers disponibles dans `window.FM` : `seg`, `clamp`, `lerp`, `easeOutCubic`, `easeInOutCubic`, `easeOutBack`, `wordProgress`. Tu peux aussi les écrire toi-même (fonctions pures).
- Tout tient dans le cadre (marge de 8 %). Un texte qui déborde est refusé.

## B. Moteur de mouvement (issu du skill « motion-design »)
- **Ressorts** : une réponse en échelon `1 - exp(-4.5·x)` (x = temps écoulé / durée), jamais de rebond élastique sur l'interface.
- **Entrées de texte** : révélation masquée, le texte monte de 105 % dans un conteneur `overflow:hidden`, mot par mot avec 55 ms de décalage et une légère rotation.
- **Caméra** : un seul conteneur transformé. Le zoom s'interpole en **échelle logarithmique**, dans un seul sens. Jamais de va-et-vient.
- **Pas d'image figée** : une micro-dérive reste active, même sur la carte finale (scale 1,00 à 1,02).
- **Plan suivant déjà en mouvement** : il entre pendant que le précédent sort.

## C. Transitions (au moins trois familles par vidéo)
Chaque transition répond à « pourquoi celle-ci, ici ? ». Pas deux fois la même famille de suite.
1. **Inondation** : un disque de couleur part de l'objet, couvre le coin le plus lointain (rayon = diagonale × 1,05) en 0,35 à 0,45 s, puis se contracte.
2. **Balayage** : un rideau de couleur traverse l'écran, 0,4 à 0,5 s.
3. **Iris** : un disque s'ouvre ou se ferme depuis le centre, 0,6 s.
4. **Fondu croisé flouté** : 0,3 à 0,4 s, le flou monte puis descend.
Une surprise environ toutes les 15 secondes (changement de fond, de couleur d'accent, de sens de caméra).

## D. Composant nouveau (obligatoire)
Chaque vidéo invente au moins un composant qui n'existe pas dans les autres : une carte, une pile, une jauge, une frise. Il doit montrer quelque chose de vrai sur le sujet (une étape, une action, un résultat). Donne-lui un nom dans le storyboard. Pas de capture d'écran ni de logo redessiné.

## E. Style
- Fond : `#f5f5f2` (ou `#f7f7f5`), ou encre `#111111`. **Jamais de `#000000` ni de `#ffffff` purs.**
- Titres : Anton, majuscules, graisse 900. Un mot clé en `#E53935`.
- Légende : Courier Prime, majuscules, espacement 0,15 em, au-dessus du centre (environ 38 %). Révélée lettre par lettre ou mot par mot.
- Accent unique : `#E53935`. Pas de dégradé dans le texte.
- Bouton final : pilule `#111` ou `#E53935`, texte clair.
- Cartes : rayon 40 px, ombre douce, perspective légère (rotateX 15 à 25°, rotateY -15 à 15°).

## F. Storyboard (à écrire avant le code)
Pour chaque plan, note : durée, texte, **transition d'entrée** (famille), **mouvement d'entrée** (ressort, masque, fondu), **composant**, **caméra**. Vérifie avant de coder :
- aucune transition ni entrée répétée deux fois de suite ;
- au moins trois familles de transitions ;
- au moins un composant nouveau ;
- une surprise tous les 15 s ;
- aucun plan plus long que 4 s sans changement.

## G. Texte
- Reprends le texte demandé mot pour mot. N'ajoute aucun mot.
- Moins de mots valent mieux. Si le sens demande une lecture, simplifie le plan.
- Le bouton final ne chevauche jamais une légende.

## H. Fin
- Carte finale avec un seul bouton. Il reste 2 à 3 secondes à l'écran.
- La vidéo finit exactement à la durée demandée.

## I. Contrôle avant de répondre
- aucune instruction interdite (section A) ;
- chaque texte demandé est présent dans la page ;
- la somme des durées égale la durée totale ;
- chaque plan a un mouvement et une entrée ;
- aucun texte ne sort de son fond, aucun ne se chevauche ;
- au moins trois familles de transitions, un composant nouveau, une surprise ;
- aucun `#000000` ni `#ffffff` pur.
Corrige ce qui échoue avant de répondre.

## J. Sortie
Uniquement le code HTML complet, sans texte autour ni balise markdown.
