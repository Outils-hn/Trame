import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Moon, Sun, Copy, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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

interface Row {
  N: number;
  holes: number;
  pitch: number;
  positions: number[];
}

function fmt(n: number, d = 1) {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

function buildRows(
  L: number,
  Ds: number,
  De: number,
  maxIntervals: number,
  integers: boolean,
): { rows: Row[]; Lu: number; Nmax: number } {
  const Lu = L - Ds - De;
  const Nmax = Math.max(0, Math.floor(maxIntervals));
  if (!isFinite(Lu) || Lu <= 0 || !isFinite(Nmax) || Nmax <= 0) {
    return { rows: [], Lu, Nmax: 0 };
  }
  const rows: Row[] = [];
  for (let N = 1; N <= Nmax; N++) {
    const rawPitch = Lu / N;
    const pitch = integers ? Math.round(rawPitch) : rawPitch;
    const positions: number[] = [];
    for (let i = 0; i <= N; i++) {
      const p = Ds + i * rawPitch;
      positions.push(integers ? Math.round(p) : p);
    }
    rows.push({ N, holes: N + 1, pitch, positions });
  }
  return { rows, Lu, Nmax };
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

function Index() {
  const [dark, setDark] = useState(false);
  const [L, setL] = useState<number>(3094);
  const [Ds, setDs] = useState<number>(50);
  const [De, setDe] = useState<number>(50);
  const [sameEnd, setSameEnd] = useState(true);
  const [pasMax, setPasMax] = useState<number>(300);
  const [integers, setIntegers] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    const m = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(m);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const effectiveDe = sameEnd ? Ds : De;

  const { rows, Lu, Nmin } = useMemo(
    () => buildRows(L, Ds, effectiveDe, pasMax, integers),
    [L, Ds, effectiveDe, pasMax, integers],
  );

  const copy = async (r: Row, idx: number) => {
    const txt = r.positions
      .map((p) => (integers ? String(p) : fmt(p, 1).replace(/\s/g, "")))
      .join("; ");
    try {
      await navigator.clipboard.writeText(txt);
      setCopiedIdx(idx);
      toast.success(`Cotes copiées (${r.holes} trous)`);
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
                Calculateur façade — pas max, temps réel
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
              <h2 className="mb-3 text-sm font-semibold">Contrainte façade</h2>
              <div className="space-y-4">
                <NumberField
                  id="pm"
                  label="Intervalles max (pas ≤)"
                  value={isFinite(pasMax) ? pasMax : ""}
                  onChange={setPasMax}
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
                <Row label="Longueur totale" value={`${fmt(L)} mm`} />
                <Row label="Marge début" value={`${fmt(Ds)} mm`} />
                <Row label="Marge fin" value={`${fmt(effectiveDe)} mm`} />
                <div className="my-2 h-px bg-border" />
                <Row label="Longueur utile" value={`${fmt(Lu)} mm`} strong />
                <Row
                  label="Intervalles min."
                  value={Nmin > 0 ? String(Nmin) : "—"}
                />
              </dl>
            </section>
          </aside>

          {/* Résultats */}
          <section>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">
                Répartitions possibles
              </h2>
              <span className="text-xs text-muted-foreground">
                Pas ≤ {fmt(pasMax)} mm · {rows.length} proposition
                {rows.length > 1 ? "s" : ""}
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                Saisissez des valeurs valides pour voir les répartitions.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {/* Header row */}
                <div className="hidden grid-cols-[60px_60px_110px_1fr_90px] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid">
                  <div>Int.</div>
                  <div>Trous</div>
                  <div>Pas</div>
                  <div>Positions (mm)</div>
                  <div className="text-right">Action</div>
                </div>

                <ul className="divide-y divide-border">
                  {rows.map((r, idx) => (
                    <li
                      key={r.N}
                      className={cn(
                        "px-5 py-4 transition-colors hover:bg-muted/30",
                        idx === 0 && "bg-muted/20",
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
                          <span className="text-[11px] text-muted-foreground">
                            mm
                          </span>
                        </div>
                        <div className="min-w-0">
                          <PositionsList
                            positions={r.positions}
                            integers={integers}
                          />
                        </div>
                        <div className="flex md:justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copy(r, idx)}
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
          </section>
        </div>

        <footer className="mt-10 border-t border-border pt-4 text-center text-[11px] text-muted-foreground">
          Cotes en millimètres · cumulées depuis le bord de départ · triées par pas
          décroissant
        </footer>
      </main>
    </div>
  );
}
