// Sauvegarde complete : toutes les donnees de l'appli (localStorage) dans un seul fichier
// .json, et restauration a l'identique. Code pur (le stockage est passe en parametre),
// teste dans full-backup.test. Meme module dans Linear, Format et Trame.

/** Le strict necessaire de localStorage : permet de tester sans navigateur. */
export interface KeyValueStore {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface BackupConfig {
  /** Nom de l'appli, ecrit dans le fichier : une sauvegarde Format ne peut pas etre restauree dans Linear. */
  app: string;
  /** Debuts des cles localStorage qui appartiennent a l'appli. */
  prefixes: string[];
  /** Cle ou est retenue la date de la derniere sauvegarde (jamais incluse dans le fichier). */
  dateKey: string;
  /** Rappel apres ce nombre de jours sans sauvegarde ; null = pas de rappel. */
  reminderDays: number | null;
}

export const BACKUP_KIND = "sauvegarde-complete";
export const BACKUP_VERSION = 1;

export interface FullBackupFile {
  app: string;
  kind: typeof BACKUP_KIND;
  version: number;
  createdAt: string;
  /** Cle localStorage -> valeur brute (texte), recopiee telle quelle a la restauration. */
  data: Record<string, string>;
}

const owns = (cfg: BackupConfig, key: string) =>
  key !== cfg.dateKey && cfg.prefixes.some((p) => key.startsWith(p));

/** Cles de l'appli presentes dans le stockage, triees. */
export function appKeys(store: KeyValueStore, cfg: BackupConfig): string[] {
  const out: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && owns(cfg, k)) out.push(k);
  }
  return out.sort();
}

export function buildBackup(store: KeyValueStore, cfg: BackupConfig, now = new Date()): FullBackupFile {
  const data: Record<string, string> = {};
  for (const k of appKeys(store, cfg)) {
    const v = store.getItem(k);
    if (v !== null) data[k] = v;
  }
  return { app: cfg.app, kind: BACKUP_KIND, version: BACKUP_VERSION, createdAt: now.toISOString(), data };
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function backupFileName(cfg: BackupConfig, now = new Date()): string {
  return `${cfg.app}-sauvegarde-complete-${isoDay(now)}.json`;
}

export type ParseResult =
  | { ok: true; backup: FullBackupFile; keyCount: number }
  | { ok: false; error: string };

/** Lit et controle un fichier de sauvegarde, avec des messages clairs en francais. */
export function parseBackup(text: string, cfg: BackupConfig): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Ce fichier n'est pas une sauvegarde lisible (format .json attendu)." };
  }
  const f = raw as Partial<FullBackupFile> | null;
  if (!f || typeof f !== "object" || f.kind !== BACKUP_KIND) {
    return { ok: false, error: "Ce fichier n'est pas une sauvegarde complète (c'est peut-être un projet seul)." };
  }
  if (f.app !== cfg.app) {
    return { ok: false, error: `Cette sauvegarde vient de l'appli « ${String(f.app)} », pas de « ${cfg.app} ».` };
  }
  if (typeof f.version !== "number" || f.version > BACKUP_VERSION) {
    return { ok: false, error: "Cette sauvegarde vient d'une version plus récente de l'appli : mettez l'appli à jour." };
  }
  if (!f.data || typeof f.data !== "object") {
    return { ok: false, error: "La sauvegarde est vide ou abîmée." };
  }
  // On ne garde que des textes, et uniquement les cles de cette appli
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(f.data)) {
    if (typeof v === "string" && owns(cfg, k)) data[k] = v;
  }
  const backup: FullBackupFile = {
    app: cfg.app, kind: BACKUP_KIND, version: f.version,
    createdAt: typeof f.createdAt === "string" ? f.createdAt : "", data,
  };
  return { ok: true, backup, keyCount: Object.keys(data).length };
}

/**
 * Remplace TOUTES les donnees de l'appli par celles de la sauvegarde.
 * Les cles des autres applis ne sont jamais touchees. Renvoie le nombre de cles ecrites.
 */
export function restoreBackup(store: KeyValueStore, cfg: BackupConfig, backup: FullBackupFile): number {
  for (const k of appKeys(store, cfg)) store.removeItem(k);
  let n = 0;
  for (const [k, v] of Object.entries(backup.data)) {
    if (!owns(cfg, k)) continue;
    store.setItem(k, v);
    n++;
  }
  return n;
}

export function markBackupDone(store: KeyValueStore, cfg: BackupConfig, now = new Date()): void {
  store.setItem(cfg.dateKey, now.toISOString());
}

/** Jours entiers depuis la derniere sauvegarde, ou null si aucune. */
export function daysSinceBackup(store: KeyValueStore, cfg: BackupConfig, now = new Date()): number | null {
  const raw = store.getItem(cfg.dateKey);
  const t = raw ? Date.parse(raw) : NaN;
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

/** Rappel utile seulement s'il y a des donnees a perdre. */
export function needsReminder(store: KeyValueStore, cfg: BackupConfig, now = new Date()): boolean {
  if (cfg.reminderDays === null) return false;
  if (appKeys(store, cfg).length === 0) return false;
  const days = daysSinceBackup(store, cfg, now);
  return days === null || days >= cfg.reminderDays;
}

/** Acces sur au localStorage : null en rendu serveur ou si le navigateur le bloque. */
export function browserStore(): KeyValueStore | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}
