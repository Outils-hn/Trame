# Journal des versions — Trame

Le numéro de version se met à jour dans `src/lib/version.ts` (pied de page et fenêtre « À propos » le lisent).

Chaque version qui change quelque chose de visible pour l'équipe a une puce « Nouveauté : … », en langage courant : c'est la seule phrase affichée sur la page « Nouveautés » de l'Accueil.

## 3.8 — 1er novembre 2026

- Nouveauté : de petites aides expliquent maintenant « Intervalles max », « conseillé » et « mm ronds » : un clic sur le « ? » ou sur la pastille ouvre une courte explication (fonctionne aussi sur téléphone).
- Les aides s'ouvrent au clic ou à Entrée et se ferment avec Échap ; cliquer sur une pastille ne change pas la répartition choisie.

## 3.7 — 1er novembre 2026

- Nouveauté : Trame refuse maintenant les saisies absurdes (entraxe minuscule, longueur de plusieurs kilomètres), accepte « 3 000 mm » avec l'unité, et dit quelles lignes de la liste de pièces sont ignorées.
- Entraxe fixe et entraxe maxi : plus de 500 perçages ou intervalles est refusé avec un message, au lieu d'afficher un résultat faux (« 294001 perçages, 0 mm »).
- Longueur limitée à 100'000 mm ; message « Saisissez un nombre, par exemple 3000 » pour un texte illisible (au lieu de « Champ vide »).
- Liste de pièces : une longueur négative (« A3 -5 ») est ignorée au lieu d'être lue comme une pièce « A3 - » de 5 mm ; les numéros des lignes ignorées sont affichés.
- Textes de 12 px minimum, pastille de l'historique plus contrastée, colonne d'option nommée pour les lecteurs d'écran, boutons de copie et bandeau plus grands sur téléphone.

## 3.6 — 1er novembre 2026

- Nouveauté : le mode clair ou sombre que tu choisis dans une appli est repris dans toutes les autres.
- Le réglage clair / sombre est aussi enregistré dans une clé commune à toutes les applis (`outils-theme`, même site) ; la clé propre à l'appli est conservée.

## 3.5 — 31 octobre 2026

- Disparition de l'avertissement technique « React #418 » dans la console du navigateur : le contenu s'affiche une fois la page chargée, au lieu de se télescoper avec la page de départ générée au build. Aucun changement visible.

## 3.4 — 31 octobre 2026

- Toutes les applis sont maintenant sur GitHub Pages : le sélecteur d'applis pointe vers `https://outils-hn.github.io/<Appli>/` à la place des adresses Lovable.

## 3.3 — 31 octobre 2026

- Adresse de Trame dans le sélecteur d'applis : `https://outils-hn.github.io/Trame/` (publiée sur GitHub Pages) à la place de l'adresse Lovable.

## 3.2 — 31 octobre 2026

- Pages « Page introuvable » et « Cette page ne s'est pas chargée » traduites en français.

## 3.1 — 31 octobre 2026

- Publication sur GitHub Pages (`https://outils-hn.github.io/Trame/`) : l'appli est construite en mode SPA statique, sans serveur.
- Nouveau workflow « Pages » : construction avec le sous-dossier `/Trame/`, page de repli `404.html`, déploiement automatique à chaque fusion sur `main`.
- Adresses mises à jour après le renommage du compte GitHub en `outils-hn` : Accueil (`https://outils-hn.github.io/`) et Strate (`https://outils-hn.github.io/Strate/`).

## 3.0 — 28 octobre 2026

- Refonte et harmonisation visuelle avec Linear et Format.
