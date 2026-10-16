import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Download, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  backupFileName, browserStore, buildBackup, daysSinceBackup, markBackupDone, needsReminder,
  parseBackup, restoreBackup, type BackupConfig, type FullBackupFile,
} from "@/lib/full-backup";

/** Telecharge la sauvegarde complete et retient la date. */
function downloadBackup(cfg: BackupConfig, suffix = ""): boolean {
  const store = browserStore();
  if (!store) return false;
  const now = new Date();
  const file = buildBackup(store, cfg, now);
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName(cfg, now).replace(/\.json$/, `${suffix}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  markBackupDone(store, cfg, now);
  return true;
}

const ilYa = (days: number | null) =>
  days === null ? "jamais" : days === 0 ? "aujourd'hui" : days === 1 ? "hier" : `il y a ${days} jours`;

const dateFr = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t)
    ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(t)
    : "date inconnue";
};

/**
 * Lien « Sauvegarde » du pied de page + fenetre : telecharger toutes les donnees de
 * l'appli en un fichier, ou les restaurer. Avant une restauration, les donnees
 * actuelles sont d'abord telechargees : on ne perd jamais rien.
 */
export function BackupLink({ cfg, appName }: { cfg: BackupConfig; appName: string }) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<number | null>(null);
  const [pending, setPending] = useState<{ backup: FullBackupFile; count: number } | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const refresh = () => {
    const store = browserStore();
    setDays(store ? daysSinceBackup(store, cfg) : null);
  };

  useEffect(() => {
    if (open) { refresh(); setPending(null); setMessage(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = () => {
    if (downloadBackup(cfg)) {
      setMessage({ text: "Sauvegarde téléchargée. Rangez le fichier en lieu sûr (dossier réseau, clé USB…).", error: false });
      refresh();
    } else {
      setMessage({ text: "Le navigateur bloque l'accès aux données : sauvegarde impossible.", error: true });
    }
  };

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de rechoisir le meme fichier
    if (!file) return;
    const result = parseBackup(await file.text(), cfg);
    if (!result.ok) { setPending(null); setMessage({ text: result.error, error: true }); return; }
    setMessage(null);
    setPending({ backup: result.backup, count: result.keyCount });
  };

  const confirmRestore = () => {
    const store = browserStore();
    if (!pending || !store) return;
    // Filet de securite : les donnees actuelles partent d'abord dans un fichier
    downloadBackup(cfg, "-avant-restauration");
    restoreBackup(store, cfg, pending.backup);
    window.location.reload();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-inherit underline-offset-2 transition-colors hover:text-foreground hover:underline"
      >
        Sauvegarde
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sauvegarde complète</DialogTitle>
            <DialogDescription>
              Toutes les données de {appName} (projets, réglages, bibliothèques) en un seul fichier. Elles ne vivent que
              dans ce navigateur : un vidage du cache ou un changement de poste les efface.
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Dernière sauvegarde : <span className="font-medium text-foreground">{ilYa(days)}</span>
          </p>

          {pending ? (
            <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p>
                Sauvegarde du <b>{dateFr(pending.backup.createdAt)}</b> ({pending.count} élément(s)).
              </p>
              <p>
                Elle va <b>remplacer toutes les données actuelles</b> de {appName}. Vos données actuelles seront d'abord
                téléchargées dans un fichier « avant-restauration », par sécurité.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setPending(null)}>Annuler</Button>
                <Button variant="destructive" onClick={confirmRestore}>Remplacer</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={save}><Download className="mr-2 h-4 w-4" />Télécharger la sauvegarde</Button>
              <Button variant="outline" onClick={() => input.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />Restaurer…
              </Button>
              <input ref={input} type="file" accept=".json,application/json" className="hidden" onChange={pick} />
            </div>
          )}

          {message && (
            <p className={`text-sm ${message.error ? "text-destructive" : "text-muted-foreground"}`}>{message.text}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Rappel discret en bas a gauche quand la derniere sauvegarde est trop ancienne
 * (et seulement s'il y a des donnees). Masquable jusqu'au prochain chargement.
 */
export function BackupReminder({ cfg, className = "bottom-4" }: { cfg: BackupConfig; className?: string }) {
  const [show, setShow] = useState(false);
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    const store = browserStore();
    if (!store) return;
    setShow(needsReminder(store, cfg));
    setDays(daysSinceBackup(store, cfg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!show) return null;
  return (
    <div className={`fixed left-4 z-40 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs shadow-md print:hidden ${className}`}>
      <span className="text-muted-foreground">
        {days === null ? "Aucune sauvegarde de vos données" : `Dernière sauvegarde ${ilYa(days)}`}
      </span>
      <Button size="sm" className="h-6 px-2 text-xs" onClick={() => { if (downloadBackup(cfg)) setShow(false); }}>
        Sauvegarder
      </Button>
      <button type="button" aria-label="Masquer le rappel" className="text-muted-foreground hover:text-foreground" onClick={() => setShow(false)}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
