/** Chantier choisi dans l'onglet « Chantiers » de l'Accueil (meme site : le navigateur le partage entre les applis). */
export const CLE_CHANTIER_ACCUEIL = "outils-chantier-info";
export function chantierAccueil(lire: (cle: string) => string | null = (c) => localStorage.getItem(c)): string {
  try {
    const i = JSON.parse(lire(CLE_CHANTIER_ACCUEIL) ?? "null");
    const numero = String(i?.numero ?? "").trim(), nom = String(i?.nom ?? "").trim();
    return numero && nom ? `${numero} · ${nom}` : numero || nom;
  } catch { return ""; }
}
