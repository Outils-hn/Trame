import { useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface Raccourci { touches: string[]; texte: string }

const COMMUNS: Raccourci[] = [
  { touches: ["Ctrl", "K"], texte: "Rechercher dans toutes les applis (ouvre l'Accueil)" },
  { touches: ["Échap"], texte: "Fermer une fenêtre ou un menu" },
  { touches: ["Entrée"], texte: "Valider la fenêtre ou le champ en cours" },
  { touches: ["Tab"], texte: "Champ suivant (Maj + Tab : précédent)" },
  { touches: ["?"], texte: "Afficher cette liste" },
];

/** Touche « ? » (hors champ de saisie) : ouvre la liste des raccourcis. */
export function useToucheAide(ouvrir: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "?") { e.preventDefault(); ouvrir(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [ouvrir]);
}

/** Liste des raccourcis clavier de l'appli ; `propres` s'ajoutent aux raccourcis communs. */
export function RaccourcisApplis({ app, open, onOpenChange, propres = [] }: { app: string; open: boolean; onOpenChange: (o: boolean) => void; propres?: Raccourci[] }) {
  const liste = [...propres, ...COMMUNS];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md text-left">
        <DialogHeader className="text-left">
          <DialogTitle className="text-sm font-semibold text-foreground">Raccourcis clavier</DialogTitle>
          <DialogDescription className="sr-only">Liste des raccourcis clavier de {app}</DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border text-sm">
          {liste.map((r) => (
            <li key={r.texte} className="flex items-center justify-between gap-4 py-2">
              <span className="text-foreground">{r.texte}</span>
              <span className="flex shrink-0 gap-1">
                {r.touches.map((t) => <kbd key={t} className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{t}</kbd>)}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
