import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Moon, Sun, Copy, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Répartition de Perçages — Calculateur Façade" },
      {
        name: "description",
        content:
          "Calculateur métier pour la répartition de perçages en façade : pas maximum, intervalles, positions cumulées.",
      },
    ],
  }),
  component: Index,
});

type Mode = "intervals" | "pitch";

interface IntervalRow {
  kind: "intervals";
  N: number;
  holes: number;
  pitch: number;
  positions: number[];
}

interface PitchRow {
  kind: "pitch";
  option: string;
  N: number;
  rDebut: number;
  entraxe: number;
  rFin: number;
  positions: number[];
}

function fmt(n: number, d = 1) {
  if (!isFinite(n)) return "—";
  const cleaned = Number(n.toFixed(d));
  return cleaned.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });
}

function buildIntervalRows(
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
  for (let N = 1; N <= Nmax; N++) {
    const rawPitch = Lu / N;
    const pitch = integers ? Math.round(rawPitch) : rawPitch;
    const positions: number[] = [];
    for (let i = 0; i <= N; i++) {
      const p = Ds + i * rawPitch;
      positions.push(integers ? Math.round(p) : p);
    }
    rows.push({ kind: "intervals", N, holes: N + 1, pitch, positions });
  }
  return { rows, Lu, Nmax };
}

function buildPitchRows(
  L: number,
  E: number,
  symmetric: boolean,
  Dstart: number,
  integers: boolean,
): PitchRow[] {
  if (!isFinite(L) || !isFinite(E) || L <= 0 || E <= 0) return [];
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
    const variants: number[] = [];
    const N = Math.floor(L / E);
    if (N >= 1) variants.push(N);
    const rive = (L - N * E) / 2;
    if (rive < 20 && N - 1 >= 1) variants.push(N - 1);

    for (const Nv of variants) {
      const r = (L - Nv * E) / 2;
      rows.push({
        kind: "pitch",
        option: "Rives symétriques",
        N: Nv,
        rDebut: integers ? Math.round(r) : r,
        entraxe: integers ? Math.round(E) : E,
        rFin: integers ? Math.round(r) : r,
        positions: makePositions(r, Nv),
      });
    }
  } else {
    if (!isFinite(Dstart) || Dstart < 0 || Dstart > L) return [];
    const rest = L - Dstart;
    const N = Math.floor(rest / E);
    if (N < 1) return [];
    const dFin = rest - N * E;
    rows.push({
      kind: "pitch",
      option: `Début fixé à ${fmt(Dstart, 1)} mm`,
      N,
      rDebut: integers ? Math.round(Dstart) : Dstart,
      entraxe: integers ? Math.round(E) : E,
      rFin: integers ? Math.round(dFin) : dFin,
      positions: makePositions(Dstart, N),
    });
  }
  return rows;
}

function PositionsList({
  positions,
  integers,
}: {
  positions: number[];
  integers: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-xs leading-relaxed text-foreground/85">
      {positions.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          <span className="tabular-nums">{integers ? p : fmt(p, 1)}</span>
          {i < positions.length - 1 && (
            <span className="text-muted-foreground/50">•</span>
          )}
        </span>
      ))}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  disabled,
  suffix = "mm",
  step = "0.1",
}: {
  id: string;
  label: string;
  value: number | "";
  onChange: (v: number) => void;
  disabled?: boolean;
  suffix?: string;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? NaN : parseFloat(v));
          }}
          className="h-11 pr-12 font-mono text-base tabular-nums"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-mono tabular-nums",
          strong ? "text-foreground font-semibold" : "text-foreground/80",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Index() {
  const [dark, setDark] = useState(false);
  const [mode, setMode] = useState<Mode>("intervals");

  // Mode 1 — intervals
  const [L, setL] = useState<number>(3094);
  const [Ds, setDs] = useState<number>(50);
  const [De, setDe] = useState<number>(50);
  const [sameEnd, setSameEnd] = useState(true);
  const [maxIntervals, setMaxIntervals] = useState<number>(5);

  // Mode 2 — fixed pitch
  const [L2, setL2] = useState<number>(3094);
  const [E, setE] = useState<number>(100);
  const [symmetric, setSymmetric] = useState(true);
  const [Dstart, setDstart] = useState<number>(50);

  const [integers, setIntegers] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const effectiveDe = sameEnd ? Ds : De;

  const intervalsData = useMemo(
    () => buildIntervalRows(L, Ds, effectiveDe, maxIntervals, integers),
    [L, Ds, effectiveDe, maxIntervals, integers],
  );

  const pitchRows = useMemo(
    () => buildPitchRows(L2, E, symmetric, Dstart, integers),
    [L2, E, symmetric, Dstart, integers],
  );

  const copy = async (positions: number[], idx: number, label: string) => {
    const txt = positions
      .map((p) => (integers ? String(p) : fmt(p, 1).replace(/\s/g, "")))
      .join("; ");
    try {
      await navigator.clipboard.writeText(txt);
      setCopiedIdx(idx);
      toast.success(`Cotes copiées (${label})`);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-right" />
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-foreground text-background">
              <span className="font-mono text-sm font-bold">PD</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">
                Répartition de Perçages
              </h1>
              <p className="text-xs text-muted-foreground">
                Calculateur façade — temps réel
              </p>
            </div>
          </div>
          <button
            onClick={() => setDark((d) => !d)}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted"
            aria-label="Basculer le thème"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="mb-6">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid">
            <TabsTrigger value="intervals">
              Répartition par Nbre d'intervalles
            </TabsTrigger>
            <TabsTrigger value="pitch">
              Calcul des rives par Entraxe Fixe
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Paramètres */}
          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            {mode === "intervals" ? (
              <>
                <section className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Paramètres</h2>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Entrée
                    </span>
                  </div>

                  <div className="space-y-4">
                    <NumberField
                      id="L"
                      label="Longueur totale (L)"
                      value={isFinite(L) ? L : ""}
                      onChange={setL}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <NumberField
                        id="ds"
                        label="Distance début"
                        value={isFinite(Ds) ? Ds : ""}
                        onChange={setDs}
                      />
                      <NumberField
                        id="de"
                        label="Distance fin"
                        value={
                          sameEnd
                            ? isFinite(Ds)
                              ? Ds
                              : ""
                            : isFinite(De)
                              ? De
                              : ""
                        }
                        onChange={setDe}
                        disabled={sameEnd}
                      />
                    </div>

                    <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                      <span className="text-xs font-medium text-foreground">
                        Identique au début
                      </span>
                      <Switch checked={sameEnd} onCheckedChange={setSameEnd} />
                    </label>
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="mb-3 text-sm font-semibold">Contrainte façade</h2>
                  <div className="space-y-4">
                    <NumberField
                      id="pm"
                      label="Intervalles max"
                      value={isFinite(maxIntervals) ? maxIntervals : ""}
                      onChange={setMaxIntervals}
                      suffix="int."
                      step="1"
                    />
                    <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                      <span className="text-xs font-medium text-foreground">
                        Mesures entières uniquement
                      </span>
                      <Switch checked={integers} onCheckedChange={setIntegers} />
                    </label>
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-muted/40 p-5">
                  <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Résumé
                  </h2>
                  <dl className="space-y-2 text-xs">
                    <SummaryRow label="Longueur totale" value={`${fmt(L)} mm`} />
                    <SummaryRow label="Marge début" value={`${fmt(Ds)} mm`} />
                    <SummaryRow label="Marge fin" value={`${fmt(effectiveDe)} mm`} />
                    <div className="my-2 h-px bg-border" />
                    <SummaryRow
                      label="Longueur utile"
                      value={`${fmt(intervalsData.Lu)} mm`}
                      strong
                    />
                    <SummaryRow
                      label="Intervalles max."
                      value={intervalsData.Nmax > 0 ? String(intervalsData.Nmax) : "—"}
                    />
                  </dl>
                </section>
              </>
            ) : (
              <>
                <section className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Paramètres</h2>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Entraxe fixe
                    </span>
                  </div>

                  <div className="space-y-4">
                    <NumberField
                      id="L2"
                      label="Longueur totale (L)"
                      value={isFinite(L2) ? L2 : ""}
                      onChange={setL2}
                    />
                    <NumberField
                      id="E"
                      label="Entraxe imposé (E)"
                      value={isFinite(E) ? E : ""}
                      onChange={setE}
                    />

                    <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                      <span className="text-xs font-medium text-foreground">
                        Rives symétriques (Début = Fin)
                      </span>
                      <Switch
                        checked={symmetric}
                        onCheckedChange={setSymmetric}
                      />
                    </label>

                    {!symmetric && (
                      <NumberField
                        id="dstart"
                        label="Distance début souhaitée"
                        value={isFinite(Dstart) ? Dstart : ""}
                        onChange={setDstart}
                      />
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="mb-3 text-sm font-semibold">Options</h2>
                  <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                    <span className="text-xs font-medium text-foreground">
                      Mesures entières uniquement
                    </span>
                    <Switch checked={integers} onCheckedChange={setIntegers} />
                  </label>
                </section>

                <section className="rounded-xl border border-border bg-muted/40 p-5">
                  <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Résumé
                  </h2>
                  <dl className="space-y-2 text-xs">
                    <SummaryRow label="Longueur totale" value={`${fmt(L2)} mm`} />
                    <SummaryRow label="Entraxe imposé" value={`${fmt(E)} mm`} />
                    <SummaryRow
                      label="Mode"
                      value={symmetric ? "Symétrique" : "Début fixé"}
                    />
                    {!symmetric && (
                      <SummaryRow label="Début" value={`${fmt(Dstart)} mm`} />
                    )}
                  </dl>
                </section>
              </>
            )}
          </aside>

          {/* Résultats */}
          <section>
            {mode === "intervals" ? (
              <IntervalsTable
                rows={intervalsData.rows}
                Nmax={intervalsData.Nmax}
                integers={integers}
                copy={copy}
                copiedIdx={copiedIdx}
              />
            ) : (
              <PitchTable
                rows={pitchRows}
                integers={integers}
                copy={copy}
                copiedIdx={copiedIdx}
              />
            )}
          </section>
        </div>

        <footer className="mt-10 border-t border-border pt-4 text-center text-[11px] text-muted-foreground">
          Cotes en millimètres · cumulées depuis le bord de départ
        </footer>
      </main>
    </div>
  );
}

function IntervalsTable({
  rows,
  Nmax,
  integers,
  copy,
  copiedIdx,
}: {
  rows: IntervalRow[];
  Nmax: number;
  integers: boolean;
  copy: (positions: number[], idx: number, label: string) => void;
  copiedIdx: number | null;
}) {
  return (
    <>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Répartitions possibles</h2>
        <span className="text-xs text-muted-foreground">
          1 → {Nmax} intervalles · {rows.length} proposition
          {rows.length > 1 ? "s" : ""}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Saisissez des valeurs valides pour voir les répartitions.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="hidden grid-cols-[60px_60px_110px_1fr_90px] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid">
            <div>Int.</div>
            <div>Trous</div>
            <div>Pas</div>
            <div>Positions (mm)</div>
            <div className="text-right">Action</div>
          </div>

          <ul>
            {rows.map((r, idx) => (
              <li
                key={r.N}
                className={cn(
                  "px-5 py-4 border-b border-gray-300 dark:border-zinc-700 transition-colors",
                  idx % 2 === 0
                    ? "bg-white dark:bg-zinc-900"
                    : "bg-slate-100 dark:bg-zinc-800",
                  "hover:bg-slate-200 dark:hover:bg-zinc-700/70",
                )}
              >
                <div className="grid gap-3 md:grid-cols-[60px_60px_110px_1fr_90px] md:items-center md:gap-4">
                  <div className="flex items-center gap-2 md:block">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground md:hidden">
                      Int.
                    </span>
                    <span className="font-mono text-base font-semibold tabular-nums">
                      {r.N}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 md:block">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground md:hidden">
                      Trous
                    </span>
                    <span className="font-mono text-base font-semibold tabular-nums">
                      {r.holes}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-lg font-bold tabular-nums text-foreground">
                      {fmt(r.pitch)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">mm</span>
                  </div>
                  <div className="min-w-0">
                    <PositionsList positions={r.positions} integers={integers} />
                  </div>
                  <div className="flex md:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copy(r.positions, idx, `${r.holes} trous`)}
                      className="gap-1.5"
                    >
                      {copiedIdx === idx ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      Copier
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function PitchTable({
  rows,
  integers,
  copy,
  copiedIdx,
}: {
  rows: PitchRow[];
  integers: boolean;
  copy: (positions: number[], idx: number, label: string) => void;
  copiedIdx: number | null;
}) {
  return (
    <>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Calcul des rives</h2>
        <span className="text-xs text-muted-foreground">
          {rows.length} proposition{rows.length > 1 ? "s" : ""}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Saisissez une longueur et un entraxe valides.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="hidden grid-cols-[1.2fr_50px_90px_90px_90px_1.4fr_90px] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid">
            <div>Option</div>
            <div>Int.</div>
            <div>Rive début</div>
            <div>Entraxe</div>
            <div>Rive fin</div>
            <div>Positions (mm)</div>
            <div className="text-right">Action</div>
          </div>

          <ul>
            {rows.map((r, idx) => (
              <li
                key={idx}
                className={cn(
                  "px-5 py-4 border-b border-gray-300 dark:border-zinc-700 transition-colors",
                  idx % 2 === 0
                    ? "bg-white dark:bg-zinc-900"
                    : "bg-slate-100 dark:bg-zinc-800",
                  "hover:bg-slate-200 dark:hover:bg-zinc-700/70",
                )}
              >
                <div className="grid gap-3 md:grid-cols-[1.2fr_50px_90px_90px_90px_1.4fr_90px] md:items-center md:gap-4">
                  <div className="text-xs font-medium text-foreground">
                    {r.option}
                  </div>
                  <div className="flex items-center gap-2 md:block">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground md:hidden">
                      Int.
                    </span>
                    <span className="font-mono text-base font-semibold tabular-nums">
                      {r.N}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-base font-semibold tabular-nums">
                      {fmt(r.rDebut)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">mm</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-base font-semibold tabular-nums text-foreground">
                      {fmt(r.entraxe)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">mm</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-base font-semibold tabular-nums">
                      {fmt(r.rFin)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">mm</span>
                  </div>
                  <div className="min-w-0">
                    <PositionsList positions={r.positions} integers={integers} />
                  </div>
                  <div className="flex md:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copy(r.positions, idx, r.option)}
                      className="gap-1.5"
                    >
                      {copiedIdx === idx ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      Copier
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
