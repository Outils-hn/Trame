# Trame

Crée une application web à page unique (Single Page Application) moderne, simple et épurée pour calculer la répartition de perçages sur une longueur. L'interface doit être de type "Dashboard utilitaire", sans graphiques ni dessins, axée sur l'efficacité brute (Design minimaliste, typographie soignée, contrastes nets, support du Dark Mode).

L'écran est divisé en deux : à gauche les paramètres d'entrée, à droite les résultats sous forme de cartes comparatives.

PARAMÈTRES D'ENTRÉE (Formulaire à gauche) :

1. Longueur Totale (L) en mm (Nombre entier/décimal).

2. Distance Début (D_debut) en mm (Par défaut: 50).

3. Distance Fin (D_fin) en mm.

   - Ajouter une case à cocher (Toggle) "Identique au début" activée par défaut, qui verrouille D_fin pour qu'elle soit égale à D_debut. Si décochée, on peut modifier D_fin.

4. Contrainte principale (Menu déroulant / Onglets) :

   - Mode A : Entraxe cible (ex: Entrez ~250 mm)

   - Mode B : Entraxe maximum strict (ex: Ne pas dépasser 300 mm)

LOGIQUE DE CALCULS ET VARIANTES (Résultats à droite) :

Calculer la Longueur Utile = L - D_debut - D_fin.

Générer et afficher instantanément 4 variantes sous forme de cartes :

- VARIANTE 1 : Optimisée (Selon le mode choisi en entrée)

  - Si Mode Entraxe Cible : Calcule le nombre d'intervalles (N) le plus proche (N = Arrondi(L_utile / Entraxe_cible)). Recalcule l'entraxe exact = L_utile / N.

  - Si Mode Entraxe Max : Calcule le nombre d'intervalles minimum requis pour ne pas dépasser le max (N = Plafond(L_utile / Entraxe_max)). Recalcule l'entraxe exact.

- VARIANTE 2 : Nombre d'intervalles PAIR

  - Force le nombre d'intervalles N à être le nombre pair le plus proche (ou supérieur selon le mode) et calcule l'entraxe exact.

- VARIANTE 3 : Nombre d'intervalles IMPAIR (Idéal pour avoir un perçage pile au centre de la barre)

  - Force le nombre d'intervalles N à être le nombre impair le plus proche et calcule l'entraxe exact.

- VARIANTE 4 : Reste à la fin (Entraxe Fixe Strict)

  - Applique l'entraxe demandé de manière stricte depuis le début. Le dernier entraxe absorbe le reste (D_fin réel sera différent de l'input).

CONTENU DES CARTES DE RÉSULTATS :

Chaque carte de variante doit afficher clairement :

- Le titre de la variante.

- Le nombre de perçages total et le nombre d'intervalles.

- L'entraxe exact calculé (affiché en gros et en gras, arrondi à 1 décimale, ex: 247.5 mm).

- Un accordéon rétractable "Voir la liste des cotes cumulées" qui, une fois déplié, affiche le tableau des coordonnées de chaque trou par rapport au point 0 (Bord de départ).

  Exemple : Trou 1 : [D_debut] mm | Trou 2 : [D_debut + E] mm | Trou 3 : [D_debut + 2E] mm...

- Un bouton "Copier les cotes" à côté de la liste pour copier les valeurs dans le presse-papier séparées par un point-virgule (ex: 50; 297.5; 545).

Ajoute un bouton de bascule Thème Clair / Thème Sombre en haut à droite de l'application. Tous les calculs doivent se mettre à jour en temps réel dès qu'un input change (pas de bouton "Valider").

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://outils-hn.github.io/Trame/

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/73d21248-f65c-4f0a-a35c-84bd6abdcd99).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
