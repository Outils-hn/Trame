import type { ReactNode } from "react";

/**
 * Bandeau commun a toutes les applis de la famille (meme fichier recopie dans chacune) :
 *   a gauche  : logo + nom (selecteur des applis), puis les onglets de l'appli ;
 *   a droite  : les actions de l'appli | le compte ou le statut, puis le bouton du theme en dernier.
 * Largeur commune : 1'440 px centres, marges de 32 px (classe « page » pour le contenu en dessous).
 * Styles : classes « bandeau-* » dans styles.css (identiques dans toutes les applis).
 */
export function Bandeau({ marque, onglets, actions, statut, theme }: {
  marque: ReactNode;
  onglets?: ReactNode;
  actions?: ReactNode;
  statut?: ReactNode;
  theme: ReactNode;
}) {
  return (
    <header className="bandeau">
      <div className="bandeau-in">
        <div className="bandeau-marque">{marque}</div>
        {onglets ? <nav aria-label="Sections" className="bandeau-nav">{onglets}</nav> : null}
        <div className="bandeau-droite">
          {actions}
          {actions && statut ? <span className="bandeau-sep" aria-hidden="true" /> : null}
          {statut}
          {theme}
        </div>
      </div>
    </header>
  );
}
