// Calculs partages sur la base commune (table « calculs », voir supabase/calculs-partages.sql).
// Meme connexion que les autres applis. On ne stocke que les donnees saisies.
import { jeton, lireSession } from "@/lib/compte";
import { CLE_CHANTIER_ACCUEIL, chantierAccueil } from "@/lib/chantier-accueil";
import type { HistoryEntry } from "@/lib/trame-history";

const URL_BASE = "https://dtxgvwaqjmmffiiohika.supabase.co/rest/v1/calculs";
const CLE = "sb_publishable_yEWGxFFSLTE1lJRXnFUmpg_dMwa6LxW";
const APP = "trame";
const CLE_LIENS = "trame:base-ids";

export interface CalculBase {
  id: string; nom: string; chantier_numero: string; chantier_nom: string;
  auteur: string; auteur_email: string; updated_at: string; supprime_le?: string | null; donnees?: HistoryEntry;
}

/** Numero et nom du chantier : ceux du texte (« 24-118 · Nom » ou « 24-118 Nom »), sinon ceux choisis dans l'Accueil. */
export function chantierDe(texte: string, lire: (c: string) => string | null = (c) => localStorage.getItem(c)): { numero: string; nom: string } {
  const [n, ...reste] = texte.split(" · ");
  if (reste.length) return { numero: (n ?? "").trim(), nom: reste.join(" · ").trim() };
  const m = /^\s*#?(\d{2}-\d{2,4})\b[\s\-–:]*(.*)$/.exec(texte);
  if (m) return { numero: m[1] ?? "", nom: (m[2] ?? "").trim() };
  try {
    const i = JSON.parse(lire(CLE_CHANTIER_ACCUEIL) ?? "null");
    const numero = String(i?.numero ?? "").trim(), nom = String(i?.nom ?? "").trim();
    if (numero) return { numero, nom: texte.trim() || nom };
  } catch { /* rien */ }
  return { numero: "", nom: texte.trim() };
}

async function appel(chemin: string, init: RequestInit = {}): Promise<unknown> {
  const t = await jeton();
  if (!t) throw new Error("Connectez-vous (compte Index) pour utiliser la base commune.");
  let r: Response;
  try {
    r = await fetch(URL_BASE + chemin, { ...init, headers: { apikey: CLE, Authorization: `Bearer ${t}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) } });
  } catch { throw new Error("Pas de connexion au serveur."); }
  if (!r.ok) {
    const m = await r.text();
    throw new Error(/relation .*calculs|42P01|PGRST205/.test(m) ? "La base commune n'est pas encore prête (script SQL à lancer)." : r.status === 401 || r.status === 403 ? "Compte non valide pour la base commune." : "Erreur du serveur.");
  }
  return r.status === 204 ? null : r.json();
}

const lireLiens = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(CLE_LIENS) ?? "{}"); } catch { return {}; } };
const ecrireLiens = (l: Record<string, string>) => { try { localStorage.setItem(CLE_LIENS, JSON.stringify(l)); } catch { /* stockage bloque */ } };

/** Envoie le projet sur la base : met a jour la copie deja partagee, sinon en cree une. */
export async function partager(p: HistoryEntry): Promise<void> {
  const { numero, nom } = chantierDe(chantierAccueil());
  const corps = { app: APP, nom: p.summary || p.moduleLabel, chantier_numero: numero, chantier_nom: nom, donnees: p, supprime_le: null };
  const liens = lireLiens(), id = liens[p.id];
  if (id) {
    const r = (await appel(`?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(corps) })) as unknown[];
    if (r.length) return; // copie partagee d'un autre auteur ou supprimee : on en recree une
  }
  const r = (await appel("", { method: "POST", body: JSON.stringify(corps) })) as { id: string }[];
  ecrireLiens({ ...liens, [p.id]: r[0].id });
}

/** Calculs Trame de la base (sans les donnees), du plus recent au plus ancien. */
export async function lister(numero = ""): Promise<CalculBase[]> {
  const f = numero ? `&chantier_numero=eq.${encodeURIComponent(numero)}` : "";
  return (await appel(`?app=eq.${APP}&supprime_le=is.null${f}&select=id,nom,chantier_numero,chantier_nom,auteur,auteur_email,updated_at&order=updated_at.desc&limit=100`)) as CalculBase[];
}

export async function lire(id: string): Promise<CalculBase | null> {
  const r = (await appel(`?id=eq.${encodeURIComponent(id)}&select=*`)) as CalculBase[];
  return r[0] ?? null;
}

/** Corbeille (30 jours) : seul l'auteur peut. */
export async function retirer(id: string): Promise<void> {
  await appel(`?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ supprime_le: new Date().toISOString() }) });
}

/** Mes calculs retires depuis moins de 30 jours (la base les efface ensuite). */
export async function corbeille(): Promise<CalculBase[]> {
  const depuis = new Date(Date.now() - 30 * 864e5).toISOString();
  return (await appel(`?app=eq.${APP}&auteur=eq.${monId()}&supprime_le=gte.${encodeURIComponent(depuis)}&select=id,nom,chantier_numero,chantier_nom,auteur,auteur_email,updated_at,supprime_le&order=supprime_le.desc&limit=50`)) as CalculBase[];
}

export async function restaurer(id: string): Promise<void> {
  await appel(`?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ supprime_le: null }) });
}

export const monId = (): string => lireSession()?.user?.id ?? "";
