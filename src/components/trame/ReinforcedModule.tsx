import { useMemo, useState } from "react";
import { ExportActions } from "@/components/trame/ExportActions";

import { Copy, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function fmt(n: number, d = 1) {
  if (!isFinite(n)) return "—";
  const cleaned = Number(n.toFixed(d));
  return cleaned.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });
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

export interface ReinforcedPoint {
  pos: number;
  zone: "start" | "center" | "end";
}

export interface ReinforcedResult {
  ok: boolean;
  reason?: "invalid" | "nointeger";
  points: ReinforcedPoint[];
  startCount: number;
  centerCount: number;
  endCount: number;
  pitchReinforced: number;
  pitchCenter: number;
  centerLength: number;
  centerIntervals: number;
}

const CENTER_LIMIT = 200;

export function computeReinforced(
  L: number,
  Ds: number,
  De: number,
  Lr: number,
  pitchR: number,
  pitchMax: number,
  integers: boolean,
): ReinforcedResult {
  const empty: ReinforcedResult = {
    ok: false,
    reason: "invalid",
    points: [],
    startCount: 0,
    centerCount: 0,
    endCount: 0,
    pitchReinforced: pitchR,
    pitchCenter: NaN,
    centerLength: NaN,
    centerIntervals: 0,
  };
  if (![L, Ds, De, Lr, pitchR, pitchMax].every((v) => isFinite(v) && v >= 0)) return empty;
  if (pitchR <= 0 || pitchMax <= 0) return empty;
  const first = Ds;
  const last = L - De;
  if (last <= first) return empty;

  // Zone renforcée début
  const startPos: number[] = [first];
  let p = first;
  while (p + pitchR <= first + Lr + 1e-9 && p + pitchR < last - 1e-9) {
    p = p + pitchR;
    startPos.push(p);
  }
  // Zone renforcée fin (depuis L - De en remontant)
  const endPos: number[] = [last];
  let q = last;
  while (q - pitchR >= last - Lr - 1e-9 && q - pitchR > startPos[startPos.length - 1] + 1e-9) {
    q = q - pitchR;
    endPos.push(q);
  }
  endPos.reverse();

  const lastStart = startPos[startPos.length - 1];
  const firstEnd = endPos[0];
  const centerLength = firstEnd - lastStart;
  if (centerLength <= 1e-9) return empty;

  let Nc = Math.max(1, Math.ceil(centerLength / pitchMax));
  let pitchCenter = centerLength / Nc;

  if (integers) {
    // FILTRE STRICT : aucune cote ne doit comporter de décimale.
    const baseIntegers =
      Number.isInteger(first) && Number.isInteger(last) && Number.isInteger(pitchR) && Number.isInteger(centerLength);
    if (!baseIntegers) return { ...empty, reason: "nointeger" };

    let found = false;
    for (let n = Nc; n <= CENTER_LIMIT; n++) {
      const cp = centerLength / n;
      if (Number.isInteger(cp) && cp <= pitchMax + 1e-9) {
        Nc = n;
        pitchCenter = cp;
        found = true;
        break;
      }
    }
    if (!found) return { ...empty, reason: "nointeger" };
  }

  const points: ReinforcedPoint[] = [];
  for (const s of startPos) points.push({ pos: s, zone: "start" });
  for (let i = 1; i < Nc; i++) points.push({ pos: lastStart + i * pitchCenter, zone: "center" });
  for (const e of endPos) points.push({ pos: e, zone: "end" });

  return {
    ok: true,
    points,
    startCount: startPos.length,
    centerCount: Nc - 1,
    endCount: endPos.length,
    pitchReinforced: pitchR,
    pitchCenter,
    centerLength,
    centerIntervals: Nc,
  };
}

import { PresetPicker } from "@/components/trame/PresetPicker";
import { useModuleHistory, type HistoryParams } from "@/lib/trame-history";
import type { MaterialPreset } from "@/lib/trame-presets";
export function ReinforcedModule({
  integers,
  setIntegers,
  EmptyNotice,
}: {
  integers: boolean;
  setIntegers: (v: boolean) => void;
  EmptyNotice: React.ComponentType<{ message: string; onShowDecimals: () => void }>;
}) {
  const [L, setL] = useState<number>(3094);
  const [Ds, setDs] = useState<number>(50);
  const [De, setDe] = useState<number>(50);
  const [sameEnd, setSameEnd] = useState(true);
  const [Lr, setLr] = useState<number>(600);
  const [pitchR, setPitchR] = useState<number>(150);
  const [pitchMax, setPitchMax] = useState<number>(300);
  const [copied, setCopied] = useState(false);

  const effectiveDe = sameEnd ? Ds : De;

  const res = useMemo(
    () => computeReinforced(L, Ds, effectiveDe, Lr, pitchR, pitchMax, integers),
    [L, Ds, effectiveDe, Lr, pitchR, pitchMax, integers],
  );

  const applyHistory = (p: HistoryParams) => {
    setL(Number(p.L));
    setDs(Number(p.Ds));
    setDe(Number(p.De));
    setSameEnd(Boolean(p.sameEnd));
    setLr(Number(p.Lr));
    setPitchR(Number(p.pitchR));
    setPitchMax(Number(p.pitchMax));
    setIntegers(Boolean(p.integers));
    toast.success("Paramètres rechargés depuis l'historique");
  };

  const saveHistory = useModuleHistory("reinforced", applyHistory);

  const applyPreset = (p: MaterialPreset) => {
    setDs(p.margin);
    setDe(p.margin);
    setPitchMax(p.pitchMax);
    toast.success(`Préréglage appliqué : ${p.name}`);
  };

  const copy = async () => {
    const txt = res.points
      .map((pt) => String(Number(pt.pos.toFixed(1))))
      .join("; ");
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      toast.success("Cotes copiées (Zone renforcée)");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <PresetPicker onApply={applyPreset} />
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Paramètres</h2>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Zone renforcée
            </span>
          </div>
          <div className="space-y-4">
            <NumberField id="rL" label="Longueur totale (L)" value={isFinite(L) ? L : ""} onChange={setL} />
            <div className="grid grid-cols-2 gap-3">
              <NumberField id="rDs" label="Distance début" value={isFinite(Ds) ? Ds : ""} onChange={setDs} />
              <NumberField
                id="rDe"
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
          <h2 className="mb-3 text-sm font-semibold">Renfort & courant</h2>
          <div className="space-y-4">
            <NumberField
              id="rLr"
              label="Longueur de zone renforcée (L_renfort)"
              value={isFinite(Lr) ? Lr : ""}
              onChange={setLr}
            />
            <NumberField
              id="rPr"
              label="Pas en zone renforcée"
              value={isFinite(pitchR) ? pitchR : ""}
              onChange={setPitchR}
            />
            <NumberField
              id="rPc"
              label="Pas max en zone courante"
              value={isFinite(pitchMax) ? pitchMax : ""}
              onChange={setPitchMax}
            />
            <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
              <span className="text-xs font-medium text-foreground">Mesures entières uniquement</span>
              <Switch checked={integers} onCheckedChange={setIntegers} />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-muted/40 p-5">
          <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Résumé</h2>
          <dl className="space-y-2 text-xs">
            <SummaryRow label="Longueur totale" value={`${fmt(L)} mm`} />
            <SummaryRow label="Marge début" value={`${fmt(Ds)} mm`} />
            <SummaryRow label="Marge fin" value={`${fmt(effectiveDe)} mm`} />
            <div className="my-2 h-px bg-border" />
            <SummaryRow label="Zone renforcée" value={`${fmt(Lr)} mm`} />
            <SummaryRow label="Zone courante" value={res.ok ? `${fmt(res.centerLength)} mm` : "—"} strong />
          </dl>
        </section>
      </aside>

      <section>
        {!res.ok ? (
          res.reason === "nointeger" ? (
            <EmptyNotice
              message="Aucune répartition entière trouvée pour cette zone courante."
              onShowDecimals={() => setIntegers(false)}
            />
          ) : (
            <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center text-sm text-muted-foreground">
              Saisissez des dimensions cohérentes (zones renforcées plus courtes que la longueur utile).
            </div>
          )
        ) : (
          <div className="space-y-5">
            {/* Carte de synthèse */}
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Trous renfort début" value={String(res.startCount)} />
              <StatCard label="Trous zone courante" value={String(res.centerCount)} />
              <StatCard label="Trous renfort fin" value={String(res.endCount)} />
              <StatCard label="Pas réel renfort" value={`${fmt(res.pitchReinforced)} mm`} accent />
              <StatCard label="Pas réel centre" value={`${fmt(res.pitchCenter)} mm`} accent />
              <StatCard label="Total trous" value={String(res.points.length)} />
            </div>

            <ExportActions
              moduleName="Zone-renforcee"
              is2D={false}
              width={L}
              holes={res.points.map((p) => ({ x: p.pos, y: 0 }))}
              params={[
                { label: "Longueur totale", value: `${fmt(L)} mm` },
                { label: "Distance début", value: `${fmt(Ds)} mm` },
                { label: "Distance fin", value: `${fmt(effectiveDe)} mm` },
                { label: "Longueur renfort", value: `${fmt(Lr)} mm` },
                { label: "Pas renfort", value: `${fmt(res.pitchReinforced)} mm` },
                { label: "Pas zone courante", value: `${fmt(res.pitchCenter)} mm` },
                { label: "Trous renfort début", value: String(res.startCount) },
                { label: "Trous renfort fin", value: String(res.endCount) },
                { label: "Total trous", value: String(res.points.length) },
              ]}
              columns={["N°", "Position (mm)", "Zone"]}
              rows={res.points.map((p, i) => [
                String(i + 1),
                fmt(p.pos),
                p.zone === "center" ? "Courante" : "Renforcée",
              ])}
              notes={["Ø perçage DXF par défaut : 8 mm.", "Cotes mesurées depuis l'extrémité gauche du profilé."]}
            />



            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold">Positions (mm)</h2>
                <Button variant="outline" size="sm" onClick={copy} className="gap-1.5">
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copier les cotes
                </Button>
              </div>

              <div className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                  {res.points.map((pt, i) => (
                    <span
                      key={i}
                      className={cn(
                        "rounded px-1.5 py-0.5 tabular-nums",
                        pt.zone === "center"
                          ? "text-foreground/85"
                          : "bg-[var(--color-trame)]/12 text-[var(--color-trame)] ring-1 ring-[var(--color-trame)]/30",
                      )}
                      title={pt.zone === "center" ? "Zone courante" : "Zone renforcée"}
                    >
                      {Number(pt.pos.toFixed(1))}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  <span className="mr-1 inline-block size-2 rounded-sm bg-[var(--color-trame)]/40 align-middle" /> cotes
                  situées en zone renforcée
                </p>
              </div>

              <ul className="border-t border-border">
                {[
                  { z: "Zone renforcée début", n: res.startCount, pas: res.pitchReinforced },
                  { z: "Zone courante", n: res.centerCount, pas: res.pitchCenter },
                  { z: "Zone renforcée fin", n: res.endCount, pas: res.pitchReinforced },
                ].map((r, idx) => (
                  <li
                    key={r.z}
                    className={cn(
                      "grid grid-cols-3 gap-3 border-b border-gray-300 px-5 py-3 dark:border-zinc-700",
                      idx % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-slate-100 dark:bg-zinc-800",
                    )}
                  >
                    <span className="text-xs font-medium text-foreground">{r.z}</span>
                    <span className="font-mono text-sm tabular-nums">{r.n} trous</span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-[var(--color-trame)]">
                      {fmt(r.pas)} mm
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-xl font-bold tabular-nums",
          accent ? "text-[var(--color-trame)]" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
