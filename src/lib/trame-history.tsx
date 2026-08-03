import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type TrameModuleKey = "standard" | "reinforced" | "obstacle" | "panel" | "expansion";

export type HistoryParams = Record<string, number | string | boolean>;

export interface HistoryEntry {
  id: string;
  ts: number;
  module: TrameModuleKey;
  /** Nom lisible du module / variante */
  moduleLabel: string;
  /** Résumé court : "Panneau 3000×1500 mm — 12 trous" */
  summary: string;
  params: HistoryParams;
}

const KEY = "trame:history:v1";
const MAX = 10;

function read(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {
    /* quota / mode privé : on ignore */
  }
}

interface Ctx {
  entries: HistoryEntry[];
  open: boolean;
  setOpen: (v: boolean) => void;
  save: (e: Omit<HistoryEntry, "id" | "ts">) => void;
  clear: () => void;
  restore: (e: HistoryEntry) => void;
  pending: HistoryEntry | null;
  consume: () => void;
}

const HistoryCtx = createContext<Ctx | null>(null);

export function TrameHistoryProvider({
  children,
  onModuleChange,
}: {
  children: React.ReactNode;
  onModuleChange: (m: TrameModuleKey) => void;
}) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<HistoryEntry | null>(null);

  useEffect(() => {
    setEntries(read());
  }, []);

  const save = useCallback((e: Omit<HistoryEntry, "id" | "ts">) => {
    setEntries((prev) => {
      const entry: HistoryEntry = {
        ...e,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ts: Date.now(),
      };
      // Évite les doublons stricts consécutifs (mêmes params, même module)
      const sig = JSON.stringify([e.module, e.params]);
      const deduped = prev.filter((p) => JSON.stringify([p.module, p.params]) !== sig);
      const next = [entry, ...deduped].slice(0, MAX);
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
    write([]);
  }, []);

  const restore = useCallback(
    (e: HistoryEntry) => {
      setPending(e);
      onModuleChange(e.module);
      setOpen(false);
    },
    [onModuleChange],
  );

  const consume = useCallback(() => setPending(null), []);

  const value = useMemo(
    () => ({ entries, open, setOpen, save, clear, restore, pending, consume }),
    [entries, open, save, clear, restore, pending, consume],
  );

  return <HistoryCtx.Provider value={value}>{children}</HistoryCtx.Provider>;
}

export function useTrameHistory() {
  const ctx = useContext(HistoryCtx);
  if (!ctx) throw new Error("useTrameHistory doit être utilisé dans TrameHistoryProvider");
  return ctx;
}

/** Enregistre un module : renvoie `save` pré-typé et applique un restore en attente. */
export function useModuleHistory(
  module: TrameModuleKey,
  apply: (params: HistoryParams) => void,
) {
  const { save, pending, consume } = useTrameHistory();

  useEffect(() => {
    if (pending && pending.module === module) {
      apply(pending.params);
      consume();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, module]);

  return useCallback(
    (moduleLabel: string, summary: string, params: HistoryParams) =>
      save({ module, moduleLabel, summary, params }),
    [save, module],
  );
}

/** "il y a 5 min" */
export function timeAgo(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "hier" : `il y a ${d} j`;
}
