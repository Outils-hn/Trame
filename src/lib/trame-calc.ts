// Calculs de repartition de percages : code pur, sans interface, teste dans trame-calc.test.ts.

export type Mode = "intervals" | "pitch" | "maxpitch";

export interface IntervalRow {
  kind: "intervals";
  N: number;
  holes: number;
  pitch: number;
  positions: number[];
}

export interface PitchRow {
  kind: "pitch";
  option: string;
  N: number;
  rDebut: number;
  entraxe: number;
  rFin: number;
  positions: number[];
}

/** Garde-fou : nombre d'intervalles maximum examine (evite de figer la page sur une saisie aberrante). */
export const MAX_INTERVALS = 500;

export function fmt(n: number, d = 1) {
  if (!isFinite(n)) return "—";
  const cleaned = Number(n.toFixed(d));
  return cleaned.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });
}

export function buildIntervalRows(
  L: number,
  Ds: number,
  De: number,
  maxIntervals: number,
  integers: boolean,
): { rows: IntervalRow[]; Lu: number; Nmax: number } {
  const Lu = L - Ds - De;
  const Nmax = Math.max(0, Math.floor(maxIntervals));
  if (!isFinite(Lu) || Lu <= 0 || !isFinite(Nmax) || Nmax <= 0) {
    return { rows: [], Lu, Nmax: 0 };
  }
  const rows: IntervalRow[] = [];
  const integerDs = Number.isInteger(Ds);
  const integerLu = Number.isInteger(Lu);
  // Plafond de securite (affichage) : bien au-dela de tout besoin reel en facade.
  const upper = Math.min(MAX_INTERVALS, Nmax);
  for (let N = 1; N <= upper; N++) {
    const rawPitch = Lu / N;
    const isIntegerPitch = integerLu && Lu % N === 0 && integerDs;
    if (integers && !isIntegerPitch) continue;
    const pitch = rawPitch;
    const positions: number[] = [];
    for (let i = 0; i <= N; i++) {
      positions.push(Ds + i * rawPitch);
    }
    rows.push({ kind: "intervals", N, holes: N + 1, pitch, positions });
  }
  return { rows, Lu, Nmax };
}

export function buildPitchRows(
  L: number,
  E: number,
  symmetric: boolean,
  Dstart: number,
  integers: boolean,
  minEdge = 0,
): PitchRow[] {
  if (!isFinite(L) || !isFinite(E) || L <= 0 || E <= 0) return [];
  // Distance au bord minimale : aucun percage plus pres du bord que cette valeur.
  const m = isFinite(minEdge) && minEdge > 0 ? minEdge : 0;
  const rows: PitchRow[] = [];

  const makePositions = (start: number, N: number) => {
    const arr: number[] = [];
    for (let i = 0; i <= N; i++) {
      const p = start + i * E;
      arr.push(integers ? Math.round(p) : p);
    }
    return arr;
  };

  if (symmetric) {
    // Le plus d'intervalles possible en respectant la distance au bord minimale,
    // puis la variante a un intervalle de moins (distances au bord plus grandes).
    const variants: number[] = [];
    const N = Math.floor((L - 2 * m) / E + 1e-9);
    if (N >= 1) variants.push(N);
    if (N - 1 >= 1) variants.push(N - 1);

    for (const Nv of variants) {
      const r = (L - Nv * E) / 2;
      // En mm entiers, un reste impair ne peut pas etre partage en deux : le mm de plus va en fin,
      // pour que debut + entraxes + fin = longueur exacte.
      const rD = integers ? Math.floor(r) : r;
      const rF = integers ? L - Nv * E - rD : r;
      rows.push({
        kind: "pitch",
        option: "Distances au bord identiques",
        N: Nv,
        rDebut: rD,
        entraxe: E,
        rFin: rF,
        positions: makePositions(rD, Nv),
      });
    }
  } else {
    if (!isFinite(Dstart) || Dstart < 0 || Dstart > L) return [];
    const rest = L - Dstart;
    // La distance au bord de fin (le reste) doit aussi respecter le minimum.
    const N = Math.floor((rest - m) / E + 1e-9);
    if (N < 1) return [];
    const dFin = rest - N * E;
    rows.push({
      kind: "pitch",
      option: `Distance au bord début ${fmt(Dstart, 1)} mm`,
      N,
      rDebut: integers ? Math.round(Dstart) : Dstart,
      entraxe: E,
      // En mm entiers, la fin prend le reste exact : debut + entraxes + fin = longueur.
      rFin: integers ? L - Math.round(Dstart) - N * E : dFin,
      positions: makePositions(integers ? Math.round(Dstart) : Dstart, N),
    });
  }
  return rows;
}

export function buildMaxPitchRows(
  L: number,
  Ds: number,
  De: number,
  Emax: number,
  integers: boolean,
): { rows: IntervalRow[]; Lu: number; Nmin: number } {
  const Lu = L - Ds - De;
  if (!isFinite(Lu) || Lu <= 0 || !isFinite(Emax) || Emax <= 0) {
    return { rows: [], Lu, Nmin: 0 };
  }
  const Nmin = Math.max(1, Math.ceil(Lu / Emax));
  const rows: IntervalRow[] = [];
  const integerDs = Number.isInteger(Ds);
  const integerLu = Number.isInteger(Lu);
  const target = 5;
  // On part toujours du minimum d'intervalles necessaire, sans plafond fixe :
  // en mm entiers on fouille plus loin pour trouver des entraxes ronds.
  const hardLimit = integers ? Nmin + 400 : Nmin + target - 1;
  for (let N = Nmin; N <= hardLimit && rows.length < target; N++) {
    const rawPitch = Lu / N;
    const isIntegerPitch = integerLu && Lu % N === 0 && integerDs;
    if (integers && !isIntegerPitch) continue;
    const positions: number[] = [];
    for (let i = 0; i <= N; i++) {
      positions.push(Ds + i * rawPitch);
    }
    rows.push({ kind: "intervals", N, holes: N + 1, pitch: rawPitch, positions });
  }
  return { rows, Lu, Nmin };
}


/**
 * Onglet 3 — rives calculées/optimisées automatiquement.
 * Cherche, pour un nombre croissant d'intervalles, la plus petite rive >= riveMin
 * telle que l'entraxe résultant reste <= Emax (et entier si demandé).
 */
export function buildAutoRiveRows(
  L: number,
  Emax: number,
  riveMin: number,
  symmetric: boolean,
  integers: boolean,
): { rows: PitchRow[]; Nmin: number } {
  if (![L, Emax, riveMin].every((v) => isFinite(v)) || L <= 0 || Emax <= 0 || riveMin < 0) {
    return { rows: [], Nmin: 0 };
  }
  if (integers && (!Number.isInteger(L) || !Number.isInteger(riveMin))) return { rows: [], Nmin: 0 };

  const Nmin = Math.max(1, Math.ceil((L - 2 * riveMin) / Emax));
  const rows: PitchRow[] = [];
  const target = 6;
  const hardLimit = integers ? Nmin + 400 : Nmin + target - 1;

  for (let N = Nmin; N <= hardLimit && rows.length < target; N++) {
    let rDebut: number | null = null;
    let rFin: number | null = null;
    let pitch = 0;

    if (symmetric) {
      const lower = Math.max(riveMin, (L - N * Emax) / 2);
      if (integers) {
        const start = Math.ceil(lower - 1e-9);
        const maxRive = (L - N) / 2; // pas >= 1 mm
        for (let r = start; r <= maxRive; r++) {
          const Lu = L - 2 * r;
          if (Lu <= 0) break;
          if (Lu % N !== 0) continue;
          const p = Lu / N;
          if (p > Emax) continue;
          rDebut = r;
          rFin = r;
          pitch = p;
          break;
        }
      } else {
        const Lu = L - 2 * lower;
        if (Lu > 0) {
          rDebut = lower;
          rFin = lower;
          pitch = Lu / N;
        }
      }
    } else {
      // Rive de début au minimum, le reliquat part sur la rive de fin
      if (integers) {
        const pStart = Math.floor(Math.min(Emax, (L - 2 * riveMin) / N));
        for (let p = pStart; p >= 1; p--) {
          const rest = L - riveMin - N * p;
          if (rest < riveMin) continue;
          rDebut = riveMin;
          rFin = rest;
          pitch = p;
          break;
        }
      } else {
        const p = Math.min(Emax, (L - 2 * riveMin) / N);
        if (p > 0) {
          rDebut = riveMin;
          rFin = L - riveMin - N * p;
          pitch = p;
        }
      }
    }

    if (rDebut === null || rFin === null || pitch <= 0 || pitch > Emax + 1e-9 || rFin < riveMin - 1e-9) continue;

    const positions: number[] = [];
    for (let i = 0; i <= N; i++) positions.push(rDebut + i * pitch);

    rows.push({
      kind: "pitch",
      option: `Proposition ${rows.length + 1} · distances au bord ${fmt(rDebut)}${
        symmetric ? "" : ` / ${fmt(rFin)}`
      } mm · entraxe ${fmt(pitch)} mm`,
      N,
      rDebut,
      entraxe: pitch,
      rFin,
      positions,
    });
  }

  return { rows, Nmin };
}

/** Une repartition prete a afficher, quel que soit le mode de calcul. */
export interface DrillOption {
  N: number;
  holes: number;
  pitch: number;
  dStart: number;
  dEnd: number;
  positions: number[];
  /** Entraxe et distance au bord debut en mm entiers : toutes les cotes tombent rond. */
  round: boolean;
  note?: string;
  /** Mode plusieurs pieces : repere et longueur propres a la ligne. */
  mark?: string;
  length?: number;
}

const isRound = (n: number) => Math.abs(n - Math.round(n)) < 1e-9;

export function fromIntervalRows(rows: IntervalRow[], dStart: number, dEnd: number): DrillOption[] {
  return rows.map((r) => ({
    N: r.N, holes: r.holes, pitch: r.pitch, dStart, dEnd, positions: r.positions,
    round: isRound(r.pitch) && isRound(dStart),
  }));
}

export function fromPitchRows(rows: PitchRow[]): DrillOption[] {
  return rows.map((r) => ({
    N: r.N, holes: r.positions.length, pitch: r.entraxe, dStart: r.rDebut, dEnd: r.rFin, positions: r.positions,
    round: isRound(r.entraxe) && isRound(r.rDebut), note: r.option,
  }));
}

/** Valeur pour AutoCAD : point decimal, sans separateur de milliers, 4 decimales max. */
export function cadNumber(n: number): string {
  return String(Number(n.toFixed(4)));
}

/** Saisie relative AutoCAD de l'entraxe, ex. "@299.4<0" (0 = vers la droite, 90 = vers le haut). */
export function cadPitch(pitch: number, angle = 0): string {
  return `@${cadNumber(pitch)}<${angle}`;
}

// ---------- Mode plusieurs pieces (entraxe maximum) ----------

export interface PieceInput {
  mark: string;
  length: number;
}

const parseLen = (s: string) => {
  const t = s.trim().replace(/\s*mm$/i, "").replace(/[\s\u00a0\u202f'\u2019\u2018]/g, "").replace(",", ".");
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
};

/**
 * Lit une liste "Repere / Longueur" collee depuis Excel (colonnes separees par tabulation)
 * ou tapee a la main ("A1 2450", "A1;2450", ou juste "2450"). La longueur est la derniere
 * cellule ; les lignes illisibles (en-tetes...) sont comptees comme ignorees.
 */
export function parsePieces(text: string): { pieces: PieceInput[]; ignored: number } {
  const pieces: PieceInput[] = [];
  let ignored = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let mark = "";
    let length = NaN;
    const cells = line.split(/\t|;/).map((c) => c.trim()).filter((c) => c !== "");
    if (cells.length > 1) {
      length = parseLen(cells[cells.length - 1]!);
      mark = cells[0]!;
    } else {
      const m = line.match(/^(.*?)[\s:=]*(\d+(?:[.,]\d+)?)\s*(?:mm)?$/i);
      if (m) {
        length = parseLen(m[2]!);
        mark = m[1]!.trim();
      }
    }
    if (!(length > 0)) {
      ignored++;
      continue;
    }
    pieces.push({ mark: mark || `P${pieces.length + 1}`, length });
  }
  return { pieces, ignored };
}

export interface MultiParams {
  /** Distances au bord calculees automatiquement (sinon Ds / De imposees). */
  auto: boolean;
  Ds: number;
  De: number;
  Emax: number;
  /** Distance au bord minimale (mode auto). */
  minEdge: number;
  /** Mode auto : distances au bord identiques. */
  symmetric: boolean;
  integers: boolean;
}

/**
 * Pour chaque piece, la solution retenue : le moins de percages possible sous l'entraxe
 * maximum (premiere proposition du mode une piece). Les pieces sans solution sont listees a part.
 */
export function buildMultiPieceOptions(
  pieces: PieceInput[],
  p: MultiParams,
): { options: DrillOption[]; failed: PieceInput[] } {
  const options: DrillOption[] = [];
  const failed: PieceInput[] = [];
  for (const piece of pieces) {
    const first = p.auto
      ? fromPitchRows(buildAutoRiveRows(piece.length, p.Emax, p.minEdge, p.symmetric, p.integers).rows)[0]
      : fromIntervalRows(buildMaxPitchRows(piece.length, p.Ds, p.De, p.Emax, p.integers).rows, p.Ds, p.De)[0];
    if (first) options.push({ ...first, note: undefined, mark: piece.mark, length: piece.length });
    else failed.push(piece);
  }
  return { options, failed };
}

/** Tableau a coller dans Excel (tabulations, virgule decimale). */
export function piecesTable(options: DrillOption[]): string {
  const n = (v: number) => String(Number(v.toFixed(2))).replace(".", ",");
  const head = ["Repère", "Longueur", "Perçages", "Entraxe", "Bord début", "Bord fin"].join("\t");
  const rows = options.map((o) =>
    [o.mark ?? "", n(o.length ?? 0), o.holes, n(o.pitch), n(o.dStart), n(o.dEnd)].join("\t"),
  );
  return [head, ...rows].join("\n");
}

/**
 * Texte de remplacement d'une cote AutoCAD pour une suite d'entraxes egaux, ex. "10 x 290 = <>".
 * "<>" est remplace par AutoCAD par la valeur mesuree ; virgule decimale, sans separateur de milliers.
 */
export function chainText(N: number, pitch: number): string {
  return `${N} x ${cadNumber(Number(pitch.toFixed(1))).replace(".", ",")} = <>`;
}
