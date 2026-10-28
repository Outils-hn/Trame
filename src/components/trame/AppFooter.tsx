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
        <DialogContent className="max-w-sm text-left">
          {/* Meme presentation que Format : titre, logo + nom + version, auteur, description, date */}
          <DialogHeader className="text-left">
            <DialogTitle className="mb-1 text-sm font-semibold text-foreground">À propos</DialogTitle>
            <DialogDescription className="sr-only">À propos de {APP_NAME}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0">
              <rect x="1" y="7" width="20" height="8" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-foreground" />
              <circle cx="5" cy="11" r="1.6" fill="currentColor" className="text-foreground" />
              <circle cx="11" cy="11" r="1.6" fill="var(--color-trame)" />
              <circle cx="17" cy="11" r="1.6" fill="currentColor" className="text-foreground" />
            </svg>
            <div>
              <p className="text-lg font-bold leading-tight text-foreground">{APP_NAME}</p>
              <p className="text-xs text-muted-foreground">Version {APP_VERSION}</p>
            </div>
          </div>
          <p className="text-sm text-foreground">Conçu et développé par {APP_AUTHOR}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{APP_TAGLINE}</p>
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">Dernière mise à jour : {APP_UPDATED}</p>
        </DialogContent>
      </Dialog>
    </footer>
  );
}
