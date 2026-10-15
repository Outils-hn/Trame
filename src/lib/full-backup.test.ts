import { describe, expect, it } from "vitest";
import {
  appKeys, backupFileName, buildBackup, daysSinceBackup, markBackupDone, needsReminder,
  parseBackup, restoreBackup, type BackupConfig, type KeyValueStore,
} from "./full-backup";

/** Faux localStorage en memoire. */
function memoryStore(init: Record<string, string> = {}): KeyValueStore {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
  };
}

const cfg: BackupConfig = { app: "test", prefixes: ["test:"], dateKey: "test:last-backup", reminderDays: 7 };
const jour = (s: string) => new Date(`${s}T12:00:00Z`);

describe("sauvegarde complete", () => {
  it("ne prend que les cles de l'appli, sans la date de sauvegarde", () => {
    const store = memoryStore({ "test:a": "1", "test:b": "{\"x\":2}", "autre:c": "3", "test:last-backup": "x" });
    expect(appKeys(store, cfg)).toEqual(["test:a", "test:b"]);
    expect(buildBackup(store, cfg).data).toEqual({ "test:a": "1", "test:b": "{\"x\":2}" });
  });

  it("aller-retour : la restauration remet exactement les memes donnees", () => {
    const source = memoryStore({ "test:a": "1", "test:b": "deux" });
    const texte = JSON.stringify(buildBackup(source, cfg));
    const cible = memoryStore({ "test:a": "ancien", "test:z": "a effacer", "autre:c": "garde" });
    const lu = parseBackup(texte, cfg);
    expect(lu.ok).toBe(true);
    if (!lu.ok) return;
    expect(restoreBackup(cible, cfg, lu.backup)).toBe(2);
    expect(cible.getItem("test:a")).toBe("1");
    expect(cible.getItem("test:b")).toBe("deux");
    expect(cible.getItem("test:z")).toBe(null);
    expect(cible.getItem("autre:c")).toBe("garde");
  });

  it("refuse un fichier illisible, un projet seul, ou une autre appli", () => {
    expect(parseBackup("pas du json", cfg).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: "test", version: 1, project: {} }), cfg).ok).toBe(false);
    const autre = parseBackup(JSON.stringify({ app: "linear", kind: "sauvegarde-complete", version: 1, data: {} }), cfg);
    expect(autre.ok).toBe(false);
    if (!autre.ok) expect(autre.error).toContain("linear");
  });

  it("refuse une version plus recente et ignore les cles etrangeres", () => {
    expect(parseBackup(JSON.stringify({ app: "test", kind: "sauvegarde-complete", version: 99, data: {} }), cfg).ok).toBe(false);
    const lu = parseBackup(JSON.stringify({ app: "test", kind: "sauvegarde-complete", version: 1, data: { "test:a": "1", "pirate:x": "2", "test:n": 3 } }), cfg);
    expect(lu.ok && lu.keyCount).toBe(1);
  });

  it("rappel : seulement s'il y a des donnees et apres le delai", () => {
    const vide = memoryStore();
    expect(needsReminder(vide, cfg, jour("2026-10-15"))).toBe(false);
    const store = memoryStore({ "test:a": "1" });
    expect(needsReminder(store, cfg, jour("2026-10-15"))).toBe(true);
    markBackupDone(store, cfg, jour("2026-10-10"));
    expect(daysSinceBackup(store, cfg, jour("2026-10-15"))).toBe(5);
    expect(needsReminder(store, cfg, jour("2026-10-15"))).toBe(false);
    expect(needsReminder(store, cfg, jour("2026-10-17"))).toBe(true);
    expect(needsReminder(store, { ...cfg, reminderDays: null }, jour("2027-01-01"))).toBe(false);
  });

  it("nom de fichier date", () => {
    expect(backupFileName(cfg, jour("2026-10-15"))).toBe("test-sauvegarde-complete-2026-10-15.json");
  });
});
