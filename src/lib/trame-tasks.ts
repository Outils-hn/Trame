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
  /** Designation de la vis (copiee depuis "mes vis" ou tapee) ; vide = non precisee. */
  screw?: string;
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
  /** Vis a commander, regroupees par designation (ordre d'apparition). */
  byScrew: { screw: string; count: number }[];
  /** Fixations sans vis renseignee. */
  noScrew: number;
}

export function taskTotals(task: Task): TaskTotals {
  const map = new Map<number, number>();
  const screws = new Map<string, { screw: string; count: number }>();
  let pieces = 0, fixings = 0, noDiameter = 0, noScrew = 0;
  for (const l of task.lines) {
    const n = lineTotal(l);
    const name = (l.screw ?? "").trim();
    if (!name) noScrew += n;
    else {
      // Meme vis malgre la casse ou les espaces : on regroupe.
      const key = name.toLowerCase().replace(/\s+/g, " ");
      const cur = screws.get(key);
      if (cur) cur.count += n;
      else screws.set(key, { screw: name, count: n });
    }
    pieces += l.qty;
    fixings += n;
    if (!l.diameters.length) noDiameter += n;
    for (const d of l.diameters) map.set(d, (map.get(d) ?? 0) + n);
  }
  const byDiameter = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([d, count]) => ({ d, count }));
  return { pieces, fixings, byDiameter, noDiameter, byScrew: [...screws.values()], noScrew };
}

/** Tableau a coller dans Excel (tabulations, virgule decimale) avec les totaux. */
export function taskTable(task: Task): string {
  const n = (v: number) => String(Number(v.toFixed(2))).replace(".", ",");
  const lines = [
    task.name,
    ["Repère", "Qté", "Longueur", "Rangées", "Perçages/rangée", "Entraxe", "Diamètres", "Vis", "Fixations"].join("\t"),
    ...task.lines.map((l) =>
      [l.mark, l.qty, n(l.length), l.rows, l.holes, n(l.pitch), l.diameters.map(fmtD).join(" + "), l.screw ?? "", lineTotal(l)].join("\t"),
    ),
  ];
  const t = taskTotals(task);
  const pad = (label: string, v: number) => [label, "", "", "", "", "", "", "", v].join("\t");
  lines.push(["Total", t.pieces, "", "", "", "", "", "", t.fixings].join("\t"));
  for (const { screw, count } of t.byScrew) lines.push(pad(screw, count));
  for (const { d, count } of t.byDiameter) lines.push(pad(`Perçages ${fmtD(d)}`, count));
  return lines.join("\n");
}

// ---------- Mes vis : bibliotheque personnelle ----------

export interface Screw {
  id: string;
  /** Designation telle qu'on la commande (ex. "SX5/7-L12 5,5x25"). */
  name: string;
  /** Diametre(s) de percage associe(s). */
  diameters: number[];
}

/** Retrouve une vis de la liste par sa designation (casse et espaces ignores). */
export function findScrew(list: Screw[], name: string): Screw | undefined {
  const k = name.trim().toLowerCase().replace(/\s+/g, " ");
  return k ? list.find((s) => s.name.trim().toLowerCase().replace(/\s+/g, " ") === k) : undefined;
}

// ---------- Stockage navigateur (jamais de serveur) ----------

const KEY = "trame:tasks:v1";

export interface TaskStore {
  tasks: Task[];
  activeId: string | null;
  screws: Screw[];
}

export function readTasks(): TaskStore {
  if (typeof window === "undefined") return { tasks: [], activeId: null, screws: [] };
  try {
    const p = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    if (p && Array.isArray(p.tasks))
      return { tasks: p.tasks, activeId: p.activeId ?? null, screws: Array.isArray(p.screws) ? p.screws : [] };
  } catch {
    /* donnees illisibles : on repart a vide */
  }
  return { tasks: [], activeId: null, screws: [] };
}

export function writeTasks(s: TaskStore) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota / mode prive : on ignore */
  }
}
