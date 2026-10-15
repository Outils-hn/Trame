import type { BackupConfig } from "./full-backup";

/** Sauvegarde complete de l'appli : quelles cles localStorage, et rappel apres combien de jours. */
export const BACKUP_CONFIG: BackupConfig = {
  app: "trame",
  prefixes: ["trame:"],
  dateKey: "trame:full-backup-date",
  reminderDays: null,
};
