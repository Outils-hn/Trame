/** « Prénom NOM » d'après les infos du compte (prénom et nom saisis à la création), sinon texte vide : on affiche alors l'email. */
export function nomAffiche(u?: { user_metadata?: Record<string, unknown> | null } | null): string {
  const m = (u?.user_metadata ?? {}) as Record<string, unknown>;
  const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const maj = (s: string) => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_x, a: string, b: string) => a + b.toUpperCase());
  let prenom = txt(m.first_name), nom = txt(m.last_name);
  if (!prenom || !nom) {
    const mots = txt(m.display_name).split(/\s+/).filter(Boolean);
    if (mots.length >= 2) { prenom = mots.slice(0, -1).join(" "); nom = mots[mots.length - 1]; }
  }
  return prenom && nom ? `${maj(prenom)} ${nom.toLocaleUpperCase("fr")}` : "";
}
