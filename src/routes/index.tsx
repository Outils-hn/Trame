import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

import { HistoryButton, HistoryPanel } from "@/components/trame/HistoryPanel";
import { ResultsView } from "@/components/trame/ResultsView";
import { AppFooter } from "@/components/trame/AppFooter";
import {
  buildAutoRiveRows,
  buildIntervalRows,
  buildMaxPitchRows,
  buildPitchRows,
  fmt,
  fromIntervalRows,
  fromPitchRows,
  type Mode,
} from "@/lib/trame-calc";
import {
  TrameHistoryProvider,
  useModuleHistory,
  type HistoryParams,
} from "@/lib/trame-history";



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
          className="h-11 pr-12 text-right text-base tabular-nums"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>
    </div>
  );
}

function Index() {
  // Trame ne garde que la répartition standard : l'historique n'a plus de module à changer.
  return (
    <TrameHistoryProvider onModuleChange={() => {}}>
      <TrameApp />
    </TrameHistoryProvider>
  );
}

function TrameApp() {
  const [dark, setDark] = useState(false);
  const [mode, setMode] = useState<Mode>("intervals");

  // Mode 1 — intervals
  const [L, setL] = useState<number>(3000);
  const [Ds, setDs] = useState<number>(50);
  const [De, setDe] = useState<number>(50);
  const [sameEnd, setSameEnd] = useState(true);
  const [maxIntervals, setMaxIntervals] = useState<number>(5);

  // Mode 2 — fixed pitch
  const [L2, setL2] = useState<number>(3000);
  const [E, setE] = useState<number>(100);
  const [symmetric, setSymmetric] = useState(true);
  const [Dstart, setDstart] = useState<number>(50);

  // Mode 3 — max pitch ceiling
  const [L3, setL3] = useState<number>(3000);
  const [Ds3, setDs3] = useState<number>(50);
  const [De3, setDe3] = useState<number>(50);
  const [sameEnd3, setSameEnd3] = useState(true);
  const [Emax, setEmax] = useState<number>(300);
  const [autoRives3, setAutoRives3] = useState(false);
  const [riveMin3, setRiveMin3] = useState<number>(30);

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
  const autoRiveData = useMemo(
    () => buildAutoRiveRows(L3, Emax, riveMin3, sameEnd3, integers),
    [L3, Emax, riveMin3, sameEnd3, integers],
  );

  const applyHistory = (p: HistoryParams) => {
    setMode((p.mode as Mode) ?? "intervals");
    setL(Number(p.L));
    setDs(Number(p.Ds));
    setDe(Number(p.De));
    setSameEnd(Boolean(p.sameEnd));
    setMaxIntervals(Number(p.maxIntervals));
    setL2(Number(p.L2));
    setE(Number(p.E));
    setSymmetric(Boolean(p.symmetric));
    setDstart(Number(p.Dstart));
    setL3(Number(p.L3));
    setDs3(Number(p.Ds3));
    setDe3(Number(p.De3));
    setSameEnd3(Boolean(p.sameEnd3));
    setEmax(Number(p.Emax));
    setAutoRives3(Boolean(p.autoRives3));
    if (p.riveMin3 !== undefined) setRiveMin3(Number(p.riveMin3));
    setIntegers(Boolean(p.integers));
    toast.success("Paramètres rechargés depuis l'historique");
  };

  const saveHistory = useModuleHistory("standard", applyHistory);

  const snapshot = (): HistoryParams => ({
    mode,
    L,
    Ds,
    De,
    sameEnd,
    maxIntervals,
    L2,
    E,
    symmetric,
    Dstart,
    L3,
    Ds3,
    De3,
    sameEnd3,
    Emax,
    autoRives3,
    riveMin3,
    integers,
  });


  const copy = async (positions: number[], idx: number, label: string, useIntegers: boolean) => {
    const txt = positions.map((p) => (useIntegers ? String(p) : fmt(p, 1).replace(/\s/g, ""))).join("; ");
    try {
      await navigator.clipboard.writeText(txt);
      setCopiedIdx(idx);
      const total = mode === "pitch" ? L2 : mode === "maxpitch" ? L3 : L;
      saveHistory(
        `Répartition Standard · ${
          mode === "pitch" ? "Entraxe fixe" : mode === "maxpitch" ? "Entraxe max" : "Nbre d'intervalles"
        }`,
        `Barre ${fmt(total, 1)} mm — ${positions.length} trous`,
        snapshot(),
      );
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
          <div className="flex items-center gap-2">
          <HistoryButton />
          <button
            onClick={() => setDark((d) => !d)}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted"
            aria-label="Basculer le thème"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          </div>
        </div>
      </header>
      <HistoryPanel />

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="mb-6">
          <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">

            <TabsTrigger
              value="intervals"
              className="data-[state=active]:text-[var(--color-trame)] data-[state=active]:shadow-[inset_0_-2px_0_var(--color-trame)]"
            >
              Par nombre d'intervalles
            </TabsTrigger>
            <TabsTrigger
              value="pitch"
              className="data-[state=active]:text-[var(--color-trame)] data-[state=active]:shadow-[inset_0_-2px_0_var(--color-trame)]"
            >
              Par entraxe fixe
            </TabsTrigger>
            <TabsTrigger
              value="maxpitch"
              className="data-[state=active]:text-[var(--color-trame)] data-[state=active]:shadow-[inset_0_-2px_0_var(--color-trame)]"
            >
              Par entraxe maximum
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
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">Paramètres</h2>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Entrée
                    </span>
                  </div>

                  <div className="space-y-4">
                    <NumberField id="L" label="Longueur totale (L)" value={isFinite(L) ? L : ""} onChange={setL} />

                    <div className="grid grid-cols-2 gap-3">
                      <NumberField id="ds" label="Distance au bord début" value={isFinite(Ds) ? Ds : ""} onChange={setDs} />
                      <NumberField
                        id="de"
                        label="Distance au bord fin"
                        value={sameEnd ? (isFinite(Ds) ? Ds : "") : isFinite(De) ? De : ""}
                        onChange={setDe}
                        disabled={sameEnd}
                      />
                    </div>

                    <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                      <span className="text-xs font-medium text-foreground">Distances au bord identiques</span>
                      <Switch checked={sameEnd} onCheckedChange={setSameEnd} />
                    </label>
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">Contrainte façade</h2>
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
              </>
            ) : mode === "pitch" ? (
              <>
                <section className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">Paramètres</h2>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Entraxe fixe
                    </span>
                  </div>

                  <div className="space-y-4">
                    <NumberField id="L2" label="Longueur totale (L)" value={isFinite(L2) ? L2 : ""} onChange={setL2} />
                    <NumberField id="E" label="Entraxe imposé (E)" value={isFinite(E) ? E : ""} onChange={setE} />

                    <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                      <span className="text-xs font-medium text-foreground">Distances au bord identiques</span>
                      <Switch checked={symmetric} onCheckedChange={setSymmetric} />
                    </label>

                    {!symmetric && (
                      <NumberField
                        id="dstart"
                        label="Distance au bord début"
                        value={isFinite(Dstart) ? Dstart : ""}
                        onChange={setDstart}
                      />
                    )}
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">Paramètres</h2>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Entraxe max
                    </span>
                  </div>

                  <div className="space-y-4">
                    <NumberField id="L3" label="Longueur totale (L)" value={isFinite(L3) ? L3 : ""} onChange={setL3} />

                    {!autoRives3 && (
                      <div className="grid grid-cols-2 gap-3">
                        <NumberField id="ds3" label="Distance au bord début" value={isFinite(Ds3) ? Ds3 : ""} onChange={setDs3} />
                        <NumberField
                          id="de3"
                          label="Distance au bord fin"
                          value={sameEnd3 ? (isFinite(Ds3) ? Ds3 : "") : isFinite(De3) ? De3 : ""}
                          onChange={setDe3}
                          disabled={sameEnd3}
                        />
                      </div>
                    )}

                    <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                      <span className="text-xs font-medium text-foreground">Distances au bord identiques</span>
                      <Switch checked={sameEnd3} onCheckedChange={setSameEnd3} />
                    </label>

                    <NumberField
                      id="emax"
                      label="Entraxe maximum"
                      value={isFinite(Emax) ? Emax : ""}
                      onChange={setEmax}
                    />

                    <label className="flex cursor-pointer items-center justify-between rounded-md border border-[var(--color-trame)]/40 bg-[var(--color-trame)]/5 px-3 py-2">
                      <span className="text-xs font-medium text-foreground">
                        Calculer les distances au bord automatiquement
                      </span>
                      <Switch checked={autoRives3} onCheckedChange={setAutoRives3} />
                    </label>

                    {autoRives3 && (
                      <NumberField
                        id="rivemin3"
                        label="Distance au bord minimale"
                        value={isFinite(riveMin3) ? riveMin3 : ""}
                        onChange={setRiveMin3}
                      />
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">Options</h2>
                  <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                    <span className="text-xs font-medium text-foreground">Mesures entières uniquement</span>
                    <Switch checked={integers} onCheckedChange={setIntegers} />
                  </label>
                </section>
              </>
            )}
          </aside>

          {/* Résultats : tableau compact des possibilités + détail de la ligne choisie */}
          <section>
            <ResultsView
              key={mode + (autoRives3 ? "-auto" : "")}
              title={
                mode === "intervals"
                  ? "Répartitions possibles"
                  : mode === "pitch"
                    ? "Répartition"
                    : autoRives3
                      ? "Distances au bord optimisées"
                      : "Répartitions sous l'entraxe maximum"
              }
              options={
                mode === "intervals"
                  ? fromIntervalRows(intervalsData.rows, Ds, effectiveDe)
                  : mode === "pitch"
                    ? fromPitchRows(pitchRows)
                    : autoRives3
                      ? fromPitchRows(autoRiveData.rows)
                      : fromIntervalRows(maxPitchData.rows, Ds3, effectiveDe3)
              }
              integers={mode === "pitch" ? false : integers}
              totalLength={mode === "intervals" ? L : mode === "pitch" ? L2 : L3}
              copy={copy}
              copiedIdx={copiedIdx}
              empty={
                mode !== "pitch" && integers ? (
                  <EmptyIntegerNotice
                    message={
                      mode === "intervals"
                        ? "Aucune répartition en millimètres entiers jusqu'à ce nombre d'intervalles."
                        : autoRives3
                          ? "Aucune répartition en millimètres entiers trouvée avec cette distance au bord minimale et cet entraxe maximum."
                          : "Aucune répartition en millimètres entiers trouvée sous la limite de 40 intervalles."
                    }
                    onShowDecimals={() => setIntegers(false)}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                    Saisissez des valeurs valides pour voir les répartitions.
                  </div>
                )
              }
            />
          </section>
        </div>

        <p className="mt-10 border-t border-border pt-4 text-center text-[11px] text-muted-foreground">
          Cotes en millimètres · cumulées depuis le bord de départ
        </p>
        <AppFooter />
      </main>
    </div>
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
            {isHi && <circle cx={cx} cy={cy} r={3.6} fill="none" stroke="var(--color-trame)" strokeWidth={1.2} opacity={0.95} />}
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
        stroke="var(--color-trame)"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <circle cx={pts[0][0]} cy={pts[0][1]} r={2.2} fill="var(--color-trame)" />
    </svg>
  );
}
