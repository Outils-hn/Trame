import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Moon, Sun, Copy, Check, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Répartition de Perçages — Calculateur" },
      {
        name: "description",
        content:
          "Calculateur en temps réel pour la répartition de perçages : entraxe cible, entraxe max, pair, impair et reste à la fin.",
      },
    ],
  }),
  component: Index,
});

type Mode = "target" | "max";

interface Variant {
  title: string;
  subtitle: string;
  N: number; // intervals
  pitch: number; // entraxe
  positions: number[];
  realStart: number;
  realEnd: number;
  valid: boolean;
  note?: string;
}

function fmt(n: number, d = 1) {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

function buildPositions(start: number, pitch: number, N: number) {
  const arr: number[] = [];
  for (let i = 0; i <= N; i++) arr.push(start + i * pitch);
  return arr;
}

function computeVariants(
  L: number,
  Ds: number,
  De: number,
  mode: Mode,
  pitchInput: number,
): Variant[] {
  const Lu = L - Ds - De;
  const variants: Variant[] = [];

  const make = (title: string, subtitle: string, N: number): Variant => {
    if (!isFinite(L) || !isFinite(Ds) || !isFinite(De) || !isFinite(pitchInput)) {
      return {
        title,
        subtitle,
        N: 0,
        pitch: NaN,
        positions: [],
        realStart: Ds,
        realEnd: De,
        valid: false,
      };
    }
    if (Lu <= 0 || N < 1) {
      return {
        title,
        subtitle,
        N: 0,
        pitch: NaN,
        positions: [],
        realStart: Ds,
        realEnd: De,
        valid: false,
        note: Lu <= 0 ? "Longueur utile invalide" : "Aucun intervalle possible",
      };
    }
    const pitch = Lu / N;
    const positions = buildPositions(Ds, pitch, N);
    return {
      title,
      subtitle,
      N,
      pitch,
      positions,
      realStart: Ds,
      realEnd: De,
      valid: true,
    };
  };

  // Variant 1: Optimisée
  let Nopt = 1;
  if (mode === "target") {
    Nopt = Math.max(1, Math.round(Lu / pitchInput));
  } else {
    Nopt = Math.max(1, Math.ceil(Lu / pitchInput));
  }
  variants.push(
    make(
      "Optimisée",
      mode === "target" ? "Entraxe le plus proche de la cible" : "Min. d'intervalles ≤ max",
      Nopt,
    ),
  );

  // Variant 2: PAIR
  let Npair: number;
  if (mode === "target") {
    const base = Math.max(2, Math.round(Lu / pitchInput));
    if (base % 2 === 0) Npair = base;
    else {
      const lower = base - 1;
      const upper = base + 1;
      const dLower = lower >= 2 ? Math.abs(Lu / lower - pitchInput) : Infinity;
      const dUpper = Math.abs(Lu / upper - pitchInput);
      Npair = dLower <= dUpper ? lower : upper;
    }
  } else {
    const base = Math.max(2, Math.ceil(Lu / pitchInput));
    Npair = base % 2 === 0 ? base : base + 1;
  }
  variants.push(make("Intervalles PAIR", "Nombre d'intervalles pair", Npair));

  // Variant 3: IMPAIR
  let Nimp: number;
  if (mode === "target") {
    const base = Math.max(1, Math.round(Lu / pitchInput));
    if (base % 2 === 1) Nimp = base;
    else {
      const lower = base - 1;
      const upper = base + 1;
      const dLower = lower >= 1 ? Math.abs(Lu / lower - pitchInput) : Infinity;
      const dUpper = Math.abs(Lu / upper - pitchInput);
      Nimp = dLower <= dUpper ? lower : upper;
    }
  } else {
    const base = Math.max(1, Math.ceil(Lu / pitchInput));
    Nimp = base % 2 === 1 ? base : base + 1;
  }
  variants.push(
    make("Intervalles IMPAIR", "Trou au centre de la barre", Nimp),
  );

  // Variant 4: Reste à la fin (entraxe strict)
  const v4: Variant = (() => {
    const title = "Reste à la fin";
    const subtitle = "Entraxe strict — reste absorbé";
    if (
      !isFinite(L) ||
      !isFinite(Ds) ||
      !isFinite(pitchInput) ||
      pitchInput <= 0 ||
      L - Ds <= 0
    ) {
      return {
        title,
        subtitle,
        N: 0,
        pitch: NaN,
        positions: [],
        realStart: Ds,
        realEnd: De,
        valid: false,
        note: "Valeurs invalides",
      };
    }
    // Place holes at Ds, Ds+pitch, ... while position <= L - De ideally,
    // but spec says "dernier entraxe absorbe le reste".
    // Interpretation: place holes strictly with pitchInput from start;
    // last hole is the one such that adding another would exceed L.
    // Then last interval = L - lastHolePosition (real D_fin).
    const usable = L - Ds;
    const N = Math.max(1, Math.floor(usable / pitchInput));
    const positions: number[] = [];
    for (let i = 0; i <= N; i++) positions.push(Ds + i * pitchInput);
    // Ensure last position <= L; if not, drop
    while (positions.length > 1 && positions[positions.length - 1] > L) {
      positions.pop();
    }
    const last = positions[positions.length - 1];
    const realEnd = L - last;
    return {
      title,
      subtitle,
      N: positions.length - 1,
      pitch: pitchInput,
      positions,
      realStart: Ds,
      realEnd,
      valid: true,
      note: `D_fin réel : ${fmt(realEnd)} mm`,
    };
  })();
  variants.push(v4);

  return variants;
}

function VariantCard({ v, index }: { v: Variant; index: number }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const txt = v.positions.map((p) => fmt(p, 1).replace(/\s/g, "")).join("; ");
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      toast.success("Cotes copiées");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  const accent = ["bg-accent-1", "bg-accent-2", "bg-accent-3", "bg-accent-4"][index];

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/20">
      <div className={cn("absolute inset-x-0 top-0 h-[2px]", accent)} />
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Variante {index + 1}
            </div>
            <h3 className="mt-1 text-base font-semibold text-foreground">{v.title}</h3>
            <p className="text-xs text-muted-foreground">{v.subtitle}</p>
          </div>
          {v.valid && (
            <div className="rounded-md border border-border bg-muted px-2 py-1 text-[11px] font-mono text-muted-foreground">
              {v.N % 2 === 0 ? "PAIR" : "IMPAIR"}
            </div>
          )}
        </div>

        {!v.valid ? (
          <p className="mt-6 text-sm text-destructive">{v.note ?? "—"}</p>
        ) : (
          <>
            <div className="mt-5 flex items-baseline gap-2">
              <span className="font-mono text-4xl font-bold tracking-tight text-foreground tabular-nums">
                {fmt(v.pitch)}
              </span>
              <span className="text-sm text-muted-foreground">mm entraxe</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <Stat label="Perçages" value={String(v.positions.length)} />
              <Stat label="Intervalles" value={String(v.N)} />
            </div>

            {v.note && (
              <p className="mt-3 text-xs text-muted-foreground">{v.note}</p>
            )}

            <Collapsible open={open} onOpenChange={setOpen} className="mt-5">
              <div className="flex items-center gap-2">
                <CollapsibleTrigger asChild>
                  <button className="flex flex-1 items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted">
                    <span>Voir la liste des cotes cumulées</span>
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform",
                        open && "rotate-180",
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copy}
                  className="gap-1.5"
                >
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  Copier
                </Button>
              </div>
              <CollapsibleContent className="mt-2 overflow-hidden">
                <div className="rounded-md border border-border bg-muted/40">
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                        <tr className="text-left text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Trou</th>
                          <th className="px-3 py-2 font-medium">Cote cumulée</th>
                          <th className="px-3 py-2 font-medium text-right">Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.positions.map((p, i) => (
                          <tr key={i} className="border-t border-border/60">
                            <td className="px-3 py-1.5 font-mono text-muted-foreground">
                              #{i + 1}
                            </td>
                            <td className="px-3 py-1.5 font-mono tabular-nums text-foreground">
                              {fmt(p)} mm
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                              {i === 0 ? "—" : `+${fmt(p - v.positions[i - 1])}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-base font-semibold tabular-nums text-foreground">
        {value}
      </div>
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

function Index() {
  const [dark, setDark] = useState(false);
  const [L, setL] = useState<number>(2000);
  const [Ds, setDs] = useState<number>(50);
  const [De, setDe] = useState<number>(50);
  const [sameEnd, setSameEnd] = useState(true);
  const [mode, setMode] = useState<Mode>("target");
  const [pitchTarget, setPitchTarget] = useState<number>(250);
  const [pitchMax, setPitchMax] = useState<number>(300);

  useEffect(() => {
    const m = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(m);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const effectiveDe = sameEnd ? Ds : De;
  const pitchInput = mode === "target" ? pitchTarget : pitchMax;
  const Lu = (L || 0) - (Ds || 0) - (effectiveDe || 0);

  const variants = useMemo(
    () => computeVariants(L, Ds, effectiveDe, mode, pitchInput),
    [L, Ds, effectiveDe, mode, pitchInput],
  );

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
                Calculateur d'entraxe — temps réel
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
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Paramètres */}
          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
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
                    value={sameEnd ? (isFinite(Ds) ? Ds : "") : isFinite(De) ? De : ""}
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
              <h2 className="mb-3 text-sm font-semibold">Contrainte</h2>
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="target">Entraxe cible</TabsTrigger>
                  <TabsTrigger value="max">Entraxe max</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="mt-4">
                {mode === "target" ? (
                  <NumberField
                    id="pt"
                    label="Entraxe cible (≈)"
                    value={isFinite(pitchTarget) ? pitchTarget : ""}
                    onChange={setPitchTarget}
                  />
                ) : (
                  <NumberField
                    id="pm"
                    label="Entraxe maximum strict"
                    value={isFinite(pitchMax) ? pitchMax : ""}
                    onChange={setPitchMax}
                  />
                )}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-muted/40 p-5">
              <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Résumé
              </h2>
              <dl className="space-y-2 text-xs">
                <Row label="Longueur totale" value={`${fmt(L)} mm`} />
                <Row label="Marge début" value={`${fmt(Ds)} mm`} />
                <Row label="Marge fin" value={`${fmt(effectiveDe)} mm`} />
                <div className="my-2 h-px bg-border" />
                <Row
                  label="Longueur utile"
                  value={`${fmt(Lu)} mm`}
                  strong
                />
              </dl>
            </section>
          </aside>

          {/* Résultats */}
          <section>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Variantes calculées</h2>
              <span className="text-xs text-muted-foreground">
                Mode : {mode === "target" ? "Entraxe cible" : "Entraxe max"}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {variants.map((v, i) => (
                <VariantCard key={i} v={v} index={i} />
              ))}
            </div>
          </section>
        </div>

        <footer className="mt-10 border-t border-border pt-4 text-center text-[11px] text-muted-foreground">
          Toutes les cotes sont en millimètres · cumulées depuis le bord de départ
        </footer>
      </main>
    </div>
  );
}

function Row({
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
