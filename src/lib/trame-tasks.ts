// Taches : regroupent des pieces percees (repere, quantite, rangees, diametres) pour compter
// les fixations a commander. Code pur, teste dans trame-tasks.test.ts ; stockage dans le navigateur.

export interface TaskLine {
  id: string;
  /** Repere de la piece (ex. "A1"). */
  mark: string;
  /** Nombre de pieces identiques. */
  qty: number;
  /** Rangees de percages par piece (2 cotes, 2 lignes de vis...). */
  rows: number;
  /** Percages par rangee. */
  holes: number;
  /** Diametre(s) du percage en mm ; plusieurs = trou etage (ex. 6,5 + 11). */
  diameters: number[];
  /** Rappel de la repartition (affichage seulement). */
  length: number;
  pitch: number;
  dStart: number;
  dEnd: number;
}

export interface Task {
  id: string;
  name: string;
  createdAt: number;
  lines: TaskLine[];
}

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Prochain nom libre : "Tâche 0001", "Tâche 0002"... */
export function nextTaskName(tasks: Task[]): string {
  let max = 0;
  for (const t of tasks) {
    const m = t.name.match(/(\d+)\s*$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `Tâche ${String(max + 1).padStart(4, "0")}`;
}

/** Lit "6,5 + 11", "Ø6.5 / Ø11", "6.5; 11" -> [6.5, 11] (sans doublon, ordre conserve). */
export function parseDiameters(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const v = Number(m[0].replace(",", "."));
    if (v > 0 && !out.includes(v)) out.push(v);
  }
  return out;
}

export const fmtD = (d: number) => `Ø${String(d).replace(".", ",")}`;

/** Fixations d'une ligne = pieces x rangees x percages par rangee. */
export const lineTotal = (l: TaskLine) => l.qty * l.rows * l.holes;

export interface TaskTotals {
  pieces: number;
  fixings: number;
  /** Percages par diametre (un trou etage compte dans chacun de ses diametres). */
  byDiameter: { d: number; count: number }[];
  /** Fixations sans diametre renseigne. */
  noDiameter: number;
}

export function taskTotals(task: Task): TaskTotals {
  const map = new Map<number, number>();
  let pieces = 0, fixings = 0, noDiameter = 0;
  for (const l of task.lines) {
    const n = lineTotal(l);
    pieces += l.qty;
    fixings += n;
    if (!l.diameters.length) noDiameter += n;
    for (const d of l.diameters) map.set(d, (map.get(d) ?? 0) + n);
  }
  const byDiameter = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([d, count]) => ({ d, count }));
  return { pieces, fixings, byDiameter, noDiameter };
}

/** Tableau a coller dans Excel (tabulations, virgule decimale) avec les totaux. */
export function taskTable(task: Task): string {
  const n = (v: number) => String(Number(v.toFixed(2))).replace(".", ",");
  const lines = [
    task.name,
    ["Repère", "Qté", "Longueur", "Rangées", "Perçages/rangée", "Entraxe", "Diamètres", "Fixations"].join("\t"),
    ...task.lines.map((l) =>
      [l.mark, l.qty, n(l.length), l.rows, l.holes, n(l.pitch), l.diameters.map(fmtD).join(" + "), lineTotal(l)].join("\t"),
    ),
  ];
  const t = taskTotals(task);
  lines.push(["Total", t.pieces, "", "", "", "", "", t.fixings].join("\t"));
  for (const { d, count } of t.byDiameter) lines.push([`Perçages ${fmtD(d)}`, "", "", "", "", "", "", count].join("\t"));
  return lines.join("\n");
}

// ---------- Stockage navigateur (jamais de serveur) ----------

const KEY = "trame:tasks:v1";

export interface TaskStore {
  tasks: Task[];
  activeId: string | null;
}

export function readTasks(): TaskStore {
  if (typeof window === "undefined") return { tasks: [], activeId: null };
  try {
    const p = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    if (p && Array.isArray(p.tasks)) return { tasks: p.tasks, activeId: p.activeId ?? null };
  } catch {
    /* donnees illisibles : on repart a vide */
  }
  return { tasks: [], activeId: null };
}

export function writeTasks(s: TaskStore) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota / mode prive : on ignore */
  }
}
