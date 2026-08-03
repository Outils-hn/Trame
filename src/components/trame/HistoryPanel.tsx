import { History, RotateCcw, Trash2 } from "lucide-react";
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
      className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
      aria-label="Ouvrir l'historique des calculs"
    >
      <History className="size-4" />
      Historique
      {entries.length > 0 && (
        <span className="rounded bg-[var(--color-trame)] px-1.5 py-0.5 text-[10px] font-bold text-white">
          {entries.length}
        </span>
      )}
    </button>
  );
}

/** Volet latéral listant les 10 derniers calculs. */
export function HistoryPanel() {
  const { open, setOpen, entries, clear, restore } = useTrameHistory();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-base">Historique des calculs</SheetTitle>
          <SheetDescription className="text-xs">
            Les 10 derniers calculs copiés ou exportés. Un clic recharge les paramètres.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2 overflow-y-auto px-4 pb-4">
          {entries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
              Aucun calcul enregistré pour le moment. Copiez ou exportez une répartition pour
              l'ajouter ici.
            </p>
          ) : (
            entries.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => restore(e)}
                className="group flex w-full items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-[var(--color-trame)] hover:bg-muted/60"
              >
                <RotateCcw className="mt-0.5 size-3.5 shrink-0 text-muted-foreground group-hover:text-[var(--color-trame)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {e.summary}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {e.moduleLabel} · {timeAgo(e.ts)}
                  </span>
                </span>
              </button>
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
