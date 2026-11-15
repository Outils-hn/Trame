import { useEffect, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { INDEX_URL, connexion, deconnexion, lireSession, useCompte } from "@/lib/compte";

// ---------- Connexion : une seule fenetre pour toute l'appli, ouverte a la demande ----------
let resolver: ((v: boolean) => void) | null = null;
const abonnes = new Set<(ouvert: boolean) => void>();

/** Vrai si un compte est connecte, sinon ouvre la fenetre de connexion (faux si l'utilisateur annule). */
export function demanderConnexion(): Promise<boolean> {
  if (lireSession()) return Promise.resolve(true);
  abonnes.forEach((f) => f(true));
  return new Promise((r) => (resolver = r));
}

/** Fenetre de connexion avec le compte Index. A placer une fois dans la page. */
export function ConnexionDialog() {
  const [ouvert, setOuvert] = useState(false);
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  useEffect(() => { abonnes.add(setOuvert); return () => void abonnes.delete(setOuvert); }, []);
  const fermer = (ok: boolean) => { setOuvert(false); setMdp(""); setErreur(null); resolver?.(ok); resolver = null; };
  const valider = async () => {
    setEnCours(true); setErreur(null);
    const e = await connexion(email, mdp);
    setEnCours(false);
    if (e) setErreur(e); else fermer(true);
  };
  const lien = "underline underline-offset-2 hover:text-foreground";
  return (
    <Dialog open={ouvert} onOpenChange={(o) => { if (!o) fermer(false); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Connexion</DialogTitle>
          <DialogDescription>Votre compte Index, valable partout.</DialogDescription>
        </DialogHeader>
        <form id="form-connexion" className="space-y-3" onSubmit={(e) => { e.preventDefault(); void valider(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="c-email">Email</Label>
            <Input id="c-email" type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-mdp">Mot de passe</Label>
            <Input id="c-mdp" type="password" autoComplete="current-password" value={mdp} onChange={(e) => setMdp(e.target.value)} />
          </div>
          {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
        </form>
        <p className="text-xs text-muted-foreground">
          <span className="block">Pas encore de compte ? <a className={lien} href={`${INDEX_URL}/auth`} target="_blank" rel="noopener noreferrer">Créer un compte dans Index</a>.</span>
          <span className="block">Un collègue doit ensuite le valider.</span>
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => fermer(false)}>Annuler</Button>
          <Button type="submit" form="form-connexion" disabled={enCours || !email || !mdp}>{enCours ? "Connexion…" : "Se connecter"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Etat du compte dans le bandeau : « Lecture seule » + Se connecter, ou email seul + Se déconnecter. */
export function CompteBandeau() {
  const c = useCompte();
  return c.connecte ? (
    <>
      <span className={c.valide === false ? "bandeau-statut" : "bandeau-statut ouvert"} title={c.email}>
        {c.valide === false ? "Compte à valider · lecture seule" : (c.nom || c.email)}
      </span>
      <button className="bandeau-btn" aria-label="Se déconnecter" onClick={deconnexion}><LogOut /><span className="max-sm:hidden">Se déconnecter</span></button>
    </>
  ) : (
    <>
      <button className="bandeau-btn" aria-label="Se connecter" onClick={() => void demanderConnexion()}><LogIn /><span className="max-sm:hidden">Se connecter</span></button>
    </>
  );
}

/** Fichier JSON (sauvegarde, projet, bibliotheque) : export ET import reserves aux comptes connectes. */
export function jsonPermis(): boolean {
  if (lireSession()) return true;
  toast.message("Fichier JSON : compte requis", { description: "Sans compte, on ne peut ni exporter ni importer de fichier JSON. Connecte-toi avec ton compte Index." });
  return false;
}

/**
 * Exports (PDF, Excel, copies, .json) : reserves aux comptes connectes (l'appli est deja protegee par la garde commune,
 * ceci est un filet de securite si la session disparait en cours d'utilisation). Sans compte, la connexion est demandee.
 * avantConnexion : ferme une fenetre deja ouverte pour laisser la place a la connexion.
 */
export async function autoriserExport(avantConnexion?: () => void): Promise<boolean> {
  if (lireSession()) return true;
  avantConnexion?.();
  return demanderConnexion();
}
