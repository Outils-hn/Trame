/**
 * « Suggestion / bug » : ouvre la page Idées & bugs de l'Accueil (nouvel onglet), formulaire pre-rempli
 * avec le nom de l'appli, sa version et la page en cours. L'equipe y voit aussi ce qui est deja signale.
 */
export const ACCUEIL_URL = "https://hnaegellen-hub.github.io/Accueil-hn/";

export function LienRetour({ app, version, className }: { app: string; version: string; className?: string }) {
  const lien = () => `${ACCUEIL_URL}?app=${encodeURIComponent(app)}&v=${encodeURIComponent(version)}&page=${encodeURIComponent(window.location.pathname)}`;
  return (
    <a
      href={`${ACCUEIL_URL}#retours`}
      target="_blank"
      rel="noopener noreferrer"
      // Lien calcule au dernier moment : la page en cours change sans recharger l'appli
      onMouseDown={(e) => { e.currentTarget.href = lien(); }}
      onFocus={(e) => { e.currentTarget.href = lien(); }}
      className={className ?? "underline-offset-2 transition-colors hover:text-foreground hover:underline"}
    >
      Suggestion / bug
    </a>
  );
}
