import { useState } from "react";
import { BackupLink, BackupReminder } from "@/components/BackupControls";
import { BACKUP_CONFIG } from "@/lib/backup-config";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { APP_AUTHOR, APP_NAME, APP_TAGLINE, APP_UPDATED, APP_VERSION, APP_YEAR } from "@/lib/version";

/**
 * Signature discrete, identique a Linear et Format : pied de page centre,
 * « Conçu par … » ouvre la fenetre « À propos ».
 */
export function AppFooter() {
  const [open, setOpen] = useState(false);
  return (
    <footer className="py-4 text-center">
      <p className="inline-block rounded-md bg-background px-2 py-0.5 text-xs text-muted-foreground/60">
        {APP_NAME} v{APP_VERSION} ·{" "}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-inherit underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Conçu par {APP_AUTHOR}
        </button>{" "}
        · {APP_YEAR} · <BackupLink cfg={BACKUP_CONFIG} appName={APP_NAME} />
      </p>
      <BackupReminder cfg={BACKUP_CONFIG} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-xl uppercase tracking-[0.22em]">{APP_NAME}</DialogTitle>
            <DialogDescription className="sr-only">À propos de {APP_NAME}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-center text-sm text-muted-foreground">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/80">Version {APP_VERSION}</p>
            <p className="text-foreground">Conçu et développé par {APP_AUTHOR}</p>
            <p className="leading-relaxed">{APP_TAGLINE}</p>
            <p className="pt-1 text-xs text-muted-foreground/70">Dernière mise à jour : {APP_UPDATED}</p>
          </div>
        </DialogContent>
      </Dialog>
    </footer>
  );
}
