import { useEffect, useState, type ReactNode } from "react";

/**
 * Application publiee en SPA (GitHub Pages) : la page de depart generee au build est vide (rien n'est calcule
 * cote serveur). On affiche donc le contenu seulement une fois dans le navigateur, au 2e rendu : le 1er rendu
 * est identique a la page de depart, ce qui evite l'erreur d'hydratation React #418 (course entre le
 * chargement du code de la page et l'affichage).
 */
export function SeulementNavigateur({ children }: { children: ReactNode }) {
  const [pret, setPret] = useState(false);
  useEffect(() => setPret(true), []);
  return pret ? <>{children}</> : null;
}
