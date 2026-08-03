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
import { ReinforcedModule } from "@/components/trame/ReinforcedModule";
import { ObstacleModule } from "@/components/trame/ObstacleModule";
import { PanelModule } from "@/components/trame/PanelModule";
import { ExpansionModule } from "@/components/trame/ExpansionModule";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trame ·" },
      {
        name: "description",
        content:
          "Trame — calculateur métier pour la répartition de perçages en façade : pas maximum, intervalles, positions cumulées.",
      },
    ],
  }),
  component: Index,
});

type Mode = "intervals" | "pitch" | "maxpitch";

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
  const integerDs = Number.isInteger(Ds);
  const integerLu = Number.isInteger(Lu);
  const upper = Math.min(20, Nmax);
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

function buildPitchRows(L: number, E: number, symmetric: boolean, Dstart: number, integers: boolean): PitchRow[] {
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

function buildMaxPitchRows(
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
  const hardLimit = integers ? 40 : Math.min(40, Nmin + target - 1);
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

function PositionsList({ positions, integers }: { positions: number[]; integers: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-xs leading-relaxed text-foreground/85">
      {positions.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          <span className="tabular-nums">{integers ? p : fmt(p, 1)}</span>
          {i < positions.length - 1 && <span className="text-muted-foreground/50">•</span>}
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

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-mono tabular-nums", strong ? "text-foreground font-semibold" : "text-foreground/80")}>
        {value}
      </dd>
    </div>
  );
}

function Index() {
  const [dark, setDark] = useState(false);
  const [mainModule, setMainModule] = useState<"standard" | "reinforced" | "obstacle" | "panel" | "expansion">("standard");
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

  // Mode 3 — max pitch ceiling
  const [L3, setL3] = useState<number>(3094);
  const [Ds3, setDs3] = useState<number>(50);
  const [De3, setDe3] = useState<number>(50);
  const [sameEnd3, setSameEnd3] = useState(true);
  const [Emax, setEmax] = useState<number>(300);

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
    () => buildPitchRows(L2, E, symmetric, Dstart, false),
    [L2, E, symmetric, Dstart],
  );

  const effectiveDe3 = sameEnd3 ? Ds3 : De3;
  const maxPitchData = useMemo(
    () => buildMaxPitchRows(L3, Ds3, effectiveDe3, Emax, integers),
    [L3, Ds3, effectiveDe3, Emax, integers],
  );

  const copy = async (positions: number[], idx: number, label: string, useIntegers: boolean) => {
    const txt = positions.map((p) => (useIntegers ? String(p) : fmt(p, 1).replace(/\s/g, ""))).join("; ");
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
      <header className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <TrameLogo className="h-10 w-10" />
            <div>
              <h1 className="font-display text-lg font-bold uppercase tracking-[0.22em] text-foreground">Trame</h1>
              <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Répartition de perçages</p>
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
        <div className="mb-6 inline-flex rounded-lg border border-border bg-card p-1">
          {(
            [
              ["standard", "Répartition Standard"],
              ["reinforced", "Zone Renforcée"],
              ["obstacle", "Évitement d'Obstacle"],
              ["panel", "Panneaux & Cassettes"],
              ["expansion", "Dilatation (PF/PG)"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setMainModule(v)}
              className={cn(
                "rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors",
                mainModule === v
                  ? "bg-[var(--color-trame)] text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mainModule === "reinforced" ? (
          <ReinforcedModule integers={integers} setIntegers={setIntegers} EmptyNotice={EmptyIntegerNotice} />
        ) : mainModule === "obstacle" ? (
          <ObstacleModule integers={integers} setIntegers={setIntegers} EmptyNotice={EmptyIntegerNotice} />
        ) : mainModule === "panel" ? (
          <PanelModule integers={integers} setIntegers={setIntegers} EmptyNotice={EmptyIntegerNotice} />
        ) : mainModule === "expansion" ? (
          <ExpansionModule integers={integers} setIntegers={setIntegers} EmptyNotice={EmptyIntegerNotice} />
        ) : (
          <>
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="mb-6">
          <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">

            <TabsTrigger
              value="intervals"
              className="data-[state=active]:text-[var(--color-trame)] data-[state=active]:shadow-[inset_0_-2px_0_var(--color-trame)]"
            >
              Par Nbre d'intervalles
            </TabsTrigger>
            <TabsTrigger
              value="pitch"
              className="data-[state=active]:text-[var(--color-trame)] data-[state=active]:shadow-[inset_0_-2px_0_var(--color-trame)]"
            >
              Par Entraxe Fixe
            </TabsTrigger>
            <TabsTrigger
              value="maxpitch"
              className="data-[state=active]:text-[var(--color-trame)] data-[state=active]:shadow-[inset_0_-2px_0_var(--color-trame)]"
            >
              Par Entraxe Maximum
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
                    <NumberField id="L" label="Longueur totale (L)" value={isFinite(L) ? L : ""} onChange={setL} />

                    <div className="grid grid-cols-2 gap-3">
                      <NumberField id="ds" label="Distance début" value={isFinite(Ds) ? Ds : ""} onChange={setDs} />
                      <NumberField
                        id="de"
                        label="Distance fin"
                        value={sameEnd ? (isFinite(Ds) ? Ds : "") : isFinite(De) ? De : ""}
                        onChange={setDe}
                        disabled={sameEnd}
                      />
                    </div>

                    <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                      <span className="text-xs font-medium text-foreground">Identique au début</span>
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
                      <span className="text-xs font-medium text-foreground">Mesures entières uniquement</span>
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
                    <SummaryRow label="Longueur utile" value={`${fmt(intervalsData.Lu)} mm`} strong />
                    <SummaryRow
                      label="Intervalles max."
                      value={intervalsData.Nmax > 0 ? String(intervalsData.Nmax) : "—"}
                    />
                  </dl>
                </section>
              </>
            ) : mode === "pitch" ? (
              <>
                <section className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Paramètres</h2>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Entraxe fixe
                    </span>
                  </div>

                  <div className="space-y-4">
                    <NumberField id="L2" label="Longueur totale (L)" value={isFinite(L2) ? L2 : ""} onChange={setL2} />
                    <NumberField id="E" label="Entraxe imposé (E)" value={isFinite(E) ? E : ""} onChange={setE} />

                    <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                      <span className="text-xs font-medium text-foreground">Rives symétriques (Début = Fin)</span>
                      <Switch checked={symmetric} onCheckedChange={setSymmetric} />
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


                <section className="rounded-xl border border-border bg-muted/40 p-5">
                  <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Résumé
                  </h2>
                  <dl className="space-y-2 text-xs">
                    <SummaryRow label="Longueur totale" value={`${fmt(L2)} mm`} />
                    <SummaryRow label="Entraxe imposé" value={`${fmt(E)} mm`} />
                    <SummaryRow label="Mode" value={symmetric ? "Symétrique" : "Début fixé"} />
                    {!symmetric && <SummaryRow label="Début" value={`${fmt(Dstart)} mm`} />}
                  </dl>
                </section>
              </>
            ) : (
              <>
                <section className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Paramètres</h2>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Entraxe max
                    </span>
                  </div>

                  <div className="space-y-4">
                    <NumberField id="L3" label="Longueur totale (L)" value={isFinite(L3) ? L3 : ""} onChange={setL3} />

                    <div className="grid grid-cols-2 gap-3">
                      <NumberField id="ds3" label="Distance début" value={isFinite(Ds3) ? Ds3 : ""} onChange={setDs3} />
                      <NumberField
                        id="de3"
                        label="Distance fin"
                        value={sameEnd3 ? (isFinite(Ds3) ? Ds3 : "") : isFinite(De3) ? De3 : ""}
                        onChange={setDe3}
                        disabled={sameEnd3}
                      />
                    </div>

                    <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                      <span className="text-xs font-medium text-foreground">Identique au début</span>
                      <Switch checked={sameEnd3} onCheckedChange={setSameEnd3} />
                    </label>

                    <NumberField
                      id="emax"
                      label="Entraxe maximum plafond (E_max)"
                      value={isFinite(Emax) ? Emax : ""}
                      onChange={setEmax}
                    />
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="mb-3 text-sm font-semibold">Options</h2>
                  <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                    <span className="text-xs font-medium text-foreground">Mesures entières uniquement</span>
                    <Switch checked={integers} onCheckedChange={setIntegers} />
                  </label>
                </section>

                <section className="rounded-xl border border-border bg-muted/40 p-5">
                  <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Résumé
                  </h2>
                  <dl className="space-y-2 text-xs">
                    <SummaryRow label="Longueur totale" value={`${fmt(L3)} mm`} />
                    <SummaryRow label="Marge début" value={`${fmt(Ds3)} mm`} />
                    <SummaryRow label="Marge fin" value={`${fmt(effectiveDe3)} mm`} />
                    <SummaryRow label="Entraxe max" value={`${fmt(Emax)} mm`} />
                    <div className="my-2 h-px bg-border" />
                    <SummaryRow label="Longueur utile" value={`${fmt(maxPitchData.Lu)} mm`} strong />
                    <SummaryRow
                      label="Intervalles min."
                      value={maxPitchData.Nmin > 0 ? String(maxPitchData.Nmin) : "—"}
                    />
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
                onShowDecimals={() => setIntegers(false)}
                emptyIntegerMessage="Aucune répartition en millimètres entiers trouvée pour les 5 premiers intervalles."
                copy={copy}
                copiedIdx={copiedIdx}
              />
            ) : mode === "pitch" ? (
              <PitchTable
                rows={pitchRows}
                integers={false}
                onShowDecimals={() => setIntegers(false)}
                emptyIntegerMessage="Aucun entraxe fixe parfait trouvé avec ces dimensions."
                copy={copy}
                copiedIdx={copiedIdx}
              />
            ) : (
              <IntervalsTable
                rows={maxPitchData.rows}
                Nmax={maxPitchData.rows.length ? maxPitchData.rows[maxPitchData.rows.length - 1].N : 0}
                integers={integers}
                onShowDecimals={() => setIntegers(false)}
                emptyIntegerMessage="Aucune répartition en millimètres entiers trouvée sous la limite de 40 intervalles."
                copy={copy}
                copiedIdx={copiedIdx}
              />
            )}
          </section>
        </div>
          </>
        )}



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
  onShowDecimals,
  emptyIntegerMessage,
  copy,
  copiedIdx,
}: {
  rows: IntervalRow[];
  Nmax: number;
  integers: boolean;
  onShowDecimals: () => void;
  emptyIntegerMessage: string;
  copy: (positions: number[], idx: number, label: string, useIntegers: boolean) => void;
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
        integers ? (
          <EmptyIntegerNotice message={emptyIntegerMessage} onShowDecimals={onShowDecimals} />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Saisissez des valeurs valides pour voir les répartitions.
          </div>
        )
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
                  idx % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-slate-100 dark:bg-zinc-800",
                  "hover:bg-slate-200 dark:hover:bg-zinc-700/70",
                )}
              >
                <div className="grid gap-3 md:grid-cols-[60px_60px_110px_1fr_90px] md:items-center md:gap-4">
                  <div className="flex items-center gap-2 md:block">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground md:hidden">Int.</span>
                    <span className="font-mono text-base font-semibold tabular-nums">{r.N}</span>
                  </div>
                  <div className="flex items-center gap-2 md:block">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground md:hidden">Trous</span>
                    <span className="font-mono text-base font-semibold tabular-nums">{r.holes}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-lg font-bold tabular-nums text-[var(--color-trame)]">
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
                      onClick={() => copy(r.positions, idx, `${r.holes} trous`, integers)}
                      className="gap-1.5"
                    >
                      {copiedIdx === idx ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
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
  onShowDecimals,
  emptyIntegerMessage,
  copy,
  copiedIdx,
}: {
  rows: PitchRow[];
  integers: boolean;
  onShowDecimals: () => void;
  emptyIntegerMessage: string;
  copy: (positions: number[], idx: number, label: string, useIntegers: boolean) => void;
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
        integers ? (
          <EmptyIntegerNotice message={emptyIntegerMessage} onShowDecimals={onShowDecimals} />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Saisissez une longueur et un entraxe valides.
          </div>
        )
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
                  idx % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-slate-100 dark:bg-zinc-800",
                  "hover:bg-slate-200 dark:hover:bg-zinc-700/70",
                )}
              >
                <div className="grid gap-3 md:grid-cols-[1.2fr_50px_90px_90px_90px_1.4fr_90px] md:items-center md:gap-4">
                  <div className="text-xs font-medium text-foreground">{r.option}</div>
                  <div className="flex items-center gap-2 md:block">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground md:hidden">Int.</span>
                    <span className="font-mono text-base font-semibold tabular-nums">{r.N}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-base font-semibold tabular-nums">{fmt(r.rDebut)}</span>
                    <span className="text-[11px] text-muted-foreground">mm</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-base font-bold tabular-nums text-[var(--color-trame)]">
                      {fmt(r.entraxe)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">mm</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-base font-semibold tabular-nums">{fmt(r.rFin)}</span>
                    <span className="text-[11px] text-muted-foreground">mm</span>
                  </div>
                  <div className="min-w-0">
                    <PositionsList positions={r.positions} integers={integers} />
                  </div>
                  <div className="flex md:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copy(r.positions, idx, r.option, integers)}
                      className="gap-1.5"
                    >
                      {copiedIdx === idx ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
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

function EmptyIntegerNotice({ message, onShowDecimals }: { message: string; onShowDecimals: () => void }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-5 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <HexWireframe className="h-20 w-20" />
      <p className="max-w-sm text-sm font-medium text-gray-600 dark:text-zinc-300">{message}</p>
      <p className="text-xs text-gray-400 dark:text-zinc-500">
        Décochez l'option pour afficher les cotes avec décimales.
      </p>
      <button
        type="button"
        onClick={onShowDecimals}
        className="mt-1 rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-[var(--color-trame)] hover:text-[var(--color-trame)]"
      >
        Afficher avec décimales
      </button>
    </div>
  );
}

function TrameLogo({ className }: { className?: string }) {
  // 5x5 dot grid; 3 successive diagonal dots highlighted with orange rings
  const dots: Array<[number, number]> = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) dots.push([x, y]);
  const highlights = new Set(["1,3", "2,2", "3,1"]);
  return (
    <svg viewBox="0 0 50 50" className={className} aria-hidden="true">
      <rect width="50" height="50" rx="8" className="fill-muted/40" />
      {dots.map(([x, y]) => {
        const cx = 5 + x * 10;
        const cy = 5 + y * 10;
        const isHi = highlights.has(`${x},${y}`);
        return (
          <g key={`${x}-${y}`}>
            {isHi && <circle cx={cx} cy={cy} r={3.6} fill="none" stroke="#ff7a22" strokeWidth={1.2} opacity={0.95} />}
            <circle cx={cx} cy={cy} r={1.3} className="fill-zinc-500 dark:fill-zinc-400" />
          </g>
        );
      })}
    </svg>
  );
}

function HexWireframe({ className }: { className?: string }) {
  // Wireframe hexagon, thin slate lines + a single orange accent edge / vertex
  const cx = 50;
  const cy = 50;
  const r = 36;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ") + " Z";
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={0.8} className="text-zinc-400 dark:text-zinc-600" />
      {/* inner triangulation */}
      {pts.map(([x, y], i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={x}
          y2={y}
          stroke="currentColor"
          strokeWidth={0.5}
          className="text-zinc-300 dark:text-zinc-700"
        />
      ))}
      {/* orange accent edge */}
      <line
        x1={pts[0][0]}
        y1={pts[0][1]}
        x2={pts[1][0]}
        y2={pts[1][1]}
        stroke="#ff7a22"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <circle cx={pts[0][0]} cy={pts[0][1]} r={2.2} fill="#ff7a22" />
    </svg>
  );
}
