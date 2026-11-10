import { useState } from "react";
import { toast } from "sonner";
import { CloudDownload, History, RotateCcw, Share2, Trash2 } from "lucide-react";
import { chantierAccueil } from "@/lib/chantier-accueil";
import { chantierDe, lire, lister, monId, partager, retirer, type CalculBase } from "@/lib/calculs-base";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTrameHistory, timeAgo } from "@/lib/trame-history";

/** Bouton d'ouverture (header). */
export function HistoryButton() {
  const { setOpen, entries } = useTrameHistory();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="bandeau-btn"
      aria-label="Ouvrir l'historique des calculs"
    >
      <History />
      Historique
      {entries.length > 0 && (
        <span className="rounded bg-[var(--app-fill)] px-1.5 py-0.5 text-xs font-bold text-white">
          {entries.length}
        </span>
      )}
    </button>
  );
}

/** Volet latéral listant les 10 derniers calculs. */
export function HistoryPanel() {
  const { open, setOpen, entries, clear, restore } = useTrameHistory();
  const [base, setBase] = useState<CalculBase[] | null>(null);
  const [charge, setCharge] = useState(false);
  const numero = chantierDe(chantierAccueil()).numero;
  const erreur = (e: unknown, d: string) => toast.error(e instanceof Error ? e.message : d);
  const actualiser = async (tous: boolean) => {
    setCharge(true);
    try { setBase(await lister(tous ? "" : numero)); } catch (e) { erreur(e, "Lecture impossible"); } finally { setCharge(false); }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-base">Historique des calculs</SheetTitle>
          <SheetDescription className="text-xs">
            Les 10 derniers calculs copiés ou exportés. Un clic recharge les paramètres ; l'icône Partager les met sur la base commune.
          </SheetDescription>
        </SheetHeader>

        <div className="mx-4 mt-3 rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Base commune</span>
            <Button variant="outline" size="sm" className="ml-auto gap-1.5" disabled={charge} onClick={() => void actualiser(false)}>
              <CloudDownload className="size-3.5" /> {numero ? `Chantier ${numero}` : "Tous"}
            </Button>
            {numero && <Button variant="ghost" size="sm" disabled={charge} onClick={() => void actualiser(true)}>Tous</Button>}
          </div>
          {base && (
            <ul className="mt-2 space-y-1">
              {base.length === 0 && <li className="py-2 text-center text-xs text-muted-foreground">Rien de partagé pour l'instant.</li>}
              {base.map((c) => (
                <li key={c.id} className="flex items-center gap-2 rounded border border-border px-2 py-1.5">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={async () => {
                    try { const x = await lire(c.id); if (x?.donnees?.params) restore(x.donnees); else toast.error("Calcul illisible."); } catch (e) { erreur(e, "Ouverture impossible"); }
                  }}>
                    <span className="block truncate text-xs font-semibold">{c.nom || "Sans nom"}</span>
                    <span className="block text-xs text-muted-foreground">{c.auteur_email.split("@")[0]} · {new Date(c.updated_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
                  </button>
                  {c.auteur === monId() && (
                    <Button variant="ghost" size="icon" aria-label="Retirer de la base" title="Retirer de la base" className="text-muted-foreground hover:text-destructive"
                      onClick={async () => { try { await retirer(c.id); setBase((l) => l && l.filter((y) => y.id !== c.id)); toast.success("Retiré de la base (corbeille 30 jours)"); } catch (e) { erreur(e, "Suppression impossible"); } }}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 space-y-2 overflow-y-auto px-4 pb-4">
          {entries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
              Aucun calcul enregistré pour le moment. Copiez ou exportez une répartition pour
              l'ajouter ici.
            </p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="flex items-stretch gap-1">
              <button
                type="button"
                onClick={() => restore(e)}
                className="group flex min-w-0 flex-1 items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-[var(--color-trame)] hover:bg-muted/60"
              >
                <RotateCcw className="mt-0.5 size-3.5 shrink-0 text-muted-foreground group-hover:text-[var(--color-trame)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {e.summary}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {e.moduleLabel} · {timeAgo(e.ts)}
                  </span>
                </span>
              </button>
              <Button variant="outline" size="icon" className="h-auto w-9 shrink-0" aria-label="Partager sur la base commune" title="Partager sur la base commune (visible dans le dossier du chantier)"
                onClick={async () => { try { await partager(e); toast.success("Partagé sur la base commune : visible dans le dossier du chantier"); } catch (x) { erreur(x, "Partage impossible"); } }}>
                <Share2 className="size-3.5" />
              </Button>
              </div>
            ))
          )}
        </div>

        {entries.length > 0 && (
          <div className="mt-auto border-t border-border px-4 py-3">
            <Button variant="outline" size="sm" onClick={clear} className="w-full gap-1.5">
              <Trash2 className="size-3.5" />
              Vider l'historique
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
