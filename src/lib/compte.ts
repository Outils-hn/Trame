// Compte Index : meme connexion que Index, Masse et les autres applis (meme site, meme
// cle de stockage). Pas de bibliotheque Supabase ici : trois appels simples a l'API d'authentification.
import { useEffect, useState } from "react";
import { nomAffiche } from "./nom-affiche";
// Adresse et cle PUBLIQUE du projet Supabase d'Index (faite pour etre visible dans une page web)
const SUPABASE_URL = "https://dtxgvwaqjmmffiiohika.supabase.co";
const SUPABASE_KEY = "sb_publishable_yEWGxFFSLTE1lJRXnFUmpg_dMwa6LxW";

export const CLE_SESSION = "sb-dtxgvwaqjmmffiiohika-auth-token";
export const INDEX_URL = "https://outils-hn.github.io/Index";
const EVENT = "outils-compte";

export interface Session { access_token: string; refresh_token: string; expires_at?: number; user?: { id: string; email?: string; user_metadata?: Record<string, unknown> } }

export function lireSession(): Session | null {
  try { const v = localStorage.getItem(CLE_SESSION); const s = v ? (JSON.parse(v) as Session) : null; return s?.access_token ? s : null; } catch { return null; }
}
function ecrireSession(s: Session | null) {
  try { if (s) localStorage.setItem(CLE_SESSION, JSON.stringify(s)); else localStorage.removeItem(CLE_SESSION); } catch { /* stockage bloque */ }
  window.dispatchEvent(new Event(EVENT));
}
const entetes = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };

function avecEcheance(r: Session & { expires_in?: number }): Session {
  return { ...r, expires_at: r.expires_at ?? Math.floor(Date.now() / 1000) + (r.expires_in ?? 3600) };
}

/** Connexion avec email + mot de passe. Renvoie un message d'erreur, ou null si c'est bon. */
export async function connexion(email: string, motDePasse: string): Promise<string | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: entetes, body: JSON.stringify({ email: email.trim(), password: motDePasse }) });
    const j = await r.json();
    if (!r.ok) {
      const m = String(j.error_description ?? j.msg ?? "");
      return /invalid login/i.test(m) ? "Email ou mot de passe incorrect." : /confirm/i.test(m) ? "Adresse email pas encore confirmée : ouvrez le lien reçu par email." : m || "Connexion impossible.";
    }
    ecrireSession(avecEcheance(j));
    return null;
  } catch { return "Pas de connexion au serveur."; }
}
export const deconnexion = () => ecrireSession(null);

/** Jeton d'acces valable (renouvele si besoin), ou null si personne n'est connecte. */
export async function jeton(): Promise<string | null> {
  const s = lireSession();
  if (!s) return null;
  if ((s.expires_at ?? 0) > Date.now() / 1000 + 30) return s.access_token;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: entetes, body: JSON.stringify({ refresh_token: s.refresh_token }) });
    if (!r.ok) return s.access_token; // reseau capricieux : on tente quand meme, la base dira si c'est refuse
    const n = avecEcheance(await r.json());
    ecrireSession(n);
    return n.access_token;
  } catch { return s.access_token; }
}

/** Le compte connecte est-il valide ? (null = inconnu / pas connecte) */
export async function compteValide(): Promise<boolean | null> {
  const t = await jeton();
  if (!t) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_approved`, { method: "POST", headers: { ...entetes, Authorization: `Bearer ${t}` }, body: "{}" });
    return r.ok ? ((await r.json()) === true) : null;
  } catch { return null; }
}

/** Etat du compte pour l'affichage : email, et validation. */
export function useCompte() {
  const [s, setS] = useState<Session | null>(null);
  const [valide, setValide] = useState<boolean | null>(null);
  useEffect(() => {
    const maj = () => setS(lireSession());
    maj();
    window.addEventListener(EVENT, maj);
    window.addEventListener("storage", maj);
    return () => { window.removeEventListener(EVENT, maj); window.removeEventListener("storage", maj); };
  }, []);
  const uid = s?.user?.id ?? s?.access_token ?? null;
  useEffect(() => {
    setValide(null);
    if (uid) void compteValide().then(setValide);
  }, [uid]);
  return { connecte: !!s, email: s?.user?.email ?? "", nom: nomAffiche(s?.user), valide };
}

