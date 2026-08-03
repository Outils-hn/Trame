import { useMemo, useState } from "react";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ExportActions } from "@/components/trame/ExportActions";


function fmt(n: number, d = 1) {
  if (!isFinite(n)) return "—";
  const cleaned = Number(n.toFixed(d));
  return cleaned.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: d });
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

export interface ObstaclePoint {
  pos: number;
  flagged?: boolean;
}

export interface ObstacleResult {
  ok: boolean;
  reason?: "invalid" | "obstacleOut" | "nointeger";
  usable: number;
  base: { pitch: number; intervals: number; points: number[]; conflicts: number[] };
  hasConflict: boolean;
  low: number;
  high: number;
  pinch: { points: ObstaclePoint[]; added: number } | null;
  pinchIntegerFail?: boolean;
  recalc: { points: ObstaclePoint[]; pitch: number; intervals: number } | null;
}

const MAX_INTERVALS = 200;

export function computeObstacle(
  L: number,
  Ds: number,
  De: number,
  pitchMax: number,
  posObs: number,
  margin: number,
  integers: boolean,
): ObstacleResult {
  const empty: ObstacleResult = {
    ok: false,
    reason: "invalid",
    usable: NaN,
    base: { pitch: NaN, intervals: 0, points: [], conflicts: [] },
    hasConflict: false,
    low: NaN,
    high: NaN,
    pinch: null,
    recalc: null,
  };
  if (![L, Ds, De, pitchMax, posObs, margin].every((v) => isFinite(v) && v >= 0)) return empty;
  if (pitchMax <= 0) return empty;
  const first = Ds;
  const last = L - De;
  const usable = last - first;
  if (usable <= 0) return empty;

  const low = posObs - margin;
  const high = posObs + margin;

  let N = Math.max(1, Math.ceil(usable / pitchMax));
  if (integers) {
    // FILTRE STRICT : toutes les cotes doivent être des entiers exacts.
    if (!Number.isInteger(first) || !Number.isInteger(last) || !Number.isInteger(usable)) {
      return { ...empty, reason: "nointeger" };
    }
    let found = false;
    for (let n = N; n <= MAX_INTERVALS; n++) {
      if (Number.isInteger(usable / n)) {
        N = n;
        found = true;
        break;
      }
    }
    if (!found) return { ...empty, reason: "nointeger" };
  }
  const pitch = usable / N;
  const points: number[] = [];
  for (let i = 0; i <= N; i++) points.push(first + i * pitch);
  const inZone = (p: number) => p > low + 1e-9 && p < high - 1e-9;
  const conflicts = points.filter(inZone);

  const base = { pitch, intervals: N, points, conflicts };

  if (posObs <= first || posObs >= last) {
    return { ...empty, ok: true, reason: "obstacleOut", usable, base, hasConflict: false, low, high };
  }

  if (conflicts.length === 0) {
    return { ok: true, usable, base, hasConflict: false, low, high, pinch: null, recalc: null };
  }

  // Solution 1 : pincement
  const pinchPoints: ObstaclePoint[] = [
    ...points.filter((p) => !inZone(p)).map((p): ObstaclePoint => ({ pos: p })),
    { pos: low, flagged: true },
    { pos: high, flagged: true },
  ].sort((a, b) => a.pos - b.pos);
  const pinchIntegerFail = integers && !(Number.isInteger(low) && Number.isInteger(high));
  const pinch = pinchIntegerFail ? null : { points: pinchPoints, added: 2 - conflicts.length };

  // Solution 2 : recalcul du pas
  let recalc: ObstacleResult["recalc"] = null;
  for (let n = N; n <= MAX_INTERVALS; n++) {
    const p = usable / n;
    if (integers && !Number.isInteger(p)) continue;
    const pts: number[] = [];
    for (let i = 0; i <= n; i++) pts.push(first + i * p);
    if (!pts.some(inZone)) {
      recalc = { points: pts.map((v) => ({ pos: v })), pitch: p, intervals: n };
      break;
    }
  }

  return { ok: true, usable, base, hasConflict: true, low, high, pinch, recalc, pinchIntegerFail };
}

function PositionList({ points }: { points: ObstaclePoint[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
      {points.map((pt, i) => (
        <span
          key={i}
          className={cn(
            "rounded px-1.5 py-0.5 tabular-nums",
            pt.flagged
              ? "bg-[var(--color-trame)]/12 text-[var(--color-trame)] ring-1 ring-[var(--color-trame)]/30"
              : "text-foreground/85",
          )}
          title={pt.flagged ? "Perçage encadrant l'obstacle" : "Perçage standard"}
        >
          {Number(pt.pos.toFixed(1))}
        </span>
      ))}
    </div>
  );
}

import { useModuleHistory, type HistoryParams } from "@/lib/trame-history";

export function ObstacleModule({
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
  const [pitchMax, setPitchMax] = useState<number>(300);
  const [posObs, setPosObs] = useState<number>(1450);
  const [margin, setMargin] = useState<number>(40);
  const [copied, setCopied] = useState<string | null>(null);

  const effectiveDe = sameEnd ? Ds : De;

  const res = useMemo(
    () => computeObstacle(L, Ds, effectiveDe, pitchMax, posObs, margin, integers),
    [L, Ds, effectiveDe, pitchMax, posObs, margin, integers],
  );

  const applyHistory = (p: HistoryParams) => {
    setL(Number(p.L));
    setDs(Number(p.Ds));
    setDe(Number(p.De));
    setSameEnd(Boolean(p.sameEnd));
    setPitchMax(Number(p.pitchMax));
    setPosObs(Number(p.posObs));
    setMargin(Number(p.margin));
    setIntegers(Boolean(p.integers));
    toast.success("Paramètres rechargés depuis l'historique");
  };

  const saveHistory = useModuleHistory("obstacle", applyHistory);


  const copy = async (key: string, points: ObstaclePoint[]) => {
    const txt = points
      .map((pt) => String(Number(pt.pos.toFixed(1))))
      .join("; ");
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(key);
      saveHistory(
        "Évitement d'Obstacle",
        `Barre ${fmt(L)} mm — ${points.length} trous`,
        { L, Ds, De, sameEnd, pitchMax, posObs, margin, integers },
      );
      toast.success("Cotes copiées");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Paramètres</h2>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Obstacle</span>
          </div>
          <div className="space-y-4">
            <NumberField id="oL" label="Longueur totale (L)" value={isFinite(L) ? L : ""} onChange={setL} />
            <div className="grid grid-cols-2 gap-3">
              <NumberField id="oDs" label="Distance début" value={isFinite(Ds) ? Ds : ""} onChange={setDs} />
              <NumberField
                id="oDe"
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
            <NumberField
              id="oPm"
              label="Pas maximum souhaité"
              value={isFinite(pitchMax) ? pitchMax : ""}
              onChange={setPitchMax}
            />
          </div>
        </section>

        <section className="rounded-xl border border-[var(--color-trame)]/40 bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Obstacle</h2>
          <div className="space-y-4">
            <NumberField
              id="oPos"
              label="Position de l'axe (Pos_obs)"
              value={isFinite(posObs) ? posObs : ""}
              onChange={setPosObs}
            />
            <NumberField
              id="oMar"
              label="Marge de sécurité"
              value={isFinite(margin) ? margin : ""}
              onChange={setMargin}
            />
            <p className="text-[11px] text-muted-foreground">
              Zone d'exclusion :{" "}
              <span className="font-mono text-[var(--color-trame)]">
                {fmt(res.low)} → {fmt(res.high)} mm
              </span>
            </p>
            <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
              <span className="text-xs font-medium text-foreground">Mesures entières uniquement</span>
              <Switch checked={integers} onCheckedChange={setIntegers} />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-muted/40 p-5">
          <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Résumé</h2>
          <dl className="space-y-2 text-xs">
            <SummaryRow label="Longueur utile" value={`${fmt(res.usable)} mm`} />
            <SummaryRow label="Intervalles de base" value={res.base.intervals ? String(res.base.intervals) : "—"} />
            <SummaryRow label="Pas théorique" value={`${fmt(res.base.pitch)} mm`} strong />
          </dl>
        </section>
      </aside>

      <section>
        {!res.ok ? (
          res.reason === "nointeger" ? (
            <EmptyNotice
              message="Aucune répartition entière trouvée pour cette barre."
              onShowDecimals={() => setIntegers(false)}
            />
          ) : (
            <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center text-sm text-muted-foreground">
              Saisissez des dimensions cohérentes (marges plus courtes que la longueur totale).
            </div>
          )
        ) : (
          <div className="space-y-5">
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold">Répartition théorique de base</h2>
                <span className="font-mono text-xs text-muted-foreground">
                  {res.base.intervals} int. · pas {fmt(res.base.pitch)} mm
                </span>
              </div>
              <div className="px-5 py-4">
                <PositionList
                  points={res.base.points.map((p) => ({
                    pos: p,
                    flagged: p > res.low + 1e-9 && p < res.high - 1e-9,
                  }))}
                />
              </div>
            </div>

            {(() => {
              const retained: ObstaclePoint[] | null = !res.hasConflict
                ? res.base.points.map((p) => ({ pos: p }))
                : (res.pinch?.points ?? res.recalc?.points ?? null);
              const label = !res.hasConflict
                ? "Répartition de base"
                : res.pinch
                  ? "Solution 1 — Pincement"
                  : res.recalc
                    ? "Solution 2 — Répartition recalculée"
                    : "—";
              const pitchLabel =
                !res.hasConflict || res.pinch ? `${fmt(res.base.pitch)} mm` : `${fmt(res.recalc?.pitch ?? NaN)} mm`;
              return (
                <ExportActions
                  moduleName="Obstacle"
                  subtitle={label}
                  is2D={false}
                  width={L}
                  holes={(retained ?? []).map((p) => ({ x: p.pos, y: 0 }))}
                  disabled={!retained}
                  params={[
                    { label: "Longueur totale", value: `${fmt(L)} mm` },
                    { label: "Distance début", value: `${fmt(Ds)} mm` },
                    { label: "Distance fin", value: `${fmt(effectiveDe)} mm` },
                    { label: "Pas max souhaité", value: `${fmt(pitchMax)} mm` },
                    { label: "Axe obstacle", value: `${fmt(posObs)} mm` },
                    { label: "Marge sécurité", value: `${fmt(margin)} mm` },
                    { label: "Zone d'exclusion", value: `${fmt(res.low)} → ${fmt(res.high)} mm` },
                    { label: "Solution retenue", value: label },
                    { label: "Pas appliqué", value: pitchLabel },
                    { label: "Total trous", value: String(retained?.length ?? 0) },
                  ]}
                  columns={["N°", "Position (mm)", "Type"]}
                  rows={(retained ?? []).map((p, i) => [
                    String(i + 1),
                    fmt(p.pos),
                    p.flagged ? "Encadrement obstacle" : "Standard",
                  ])}
                  notes={[
                    "Ø perçage DXF par défaut : 8 mm.",
                    `Zone d'exclusion à respecter : ${fmt(res.low)} → ${fmt(res.high)} mm.`,
                  ]}
                />
              );
            })()}



            {!res.hasConflict ? (
              <div className="rounded-xl border border-border bg-card px-5 py-6 text-sm text-muted-foreground">
                {res.reason === "obstacleOut"
                  ? "L'obstacle est situé hors de la zone de perçage : aucune correction nécessaire."
                  : "Aucun perçage ne tombe dans la zone d'exclusion : la répartition de base est directement exploitable."}
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">
                {/* Solution 1 */}
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="border-b border-border px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">Solution 1 — Pincement</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!res.pinch}
                        onClick={() => res.pinch && copy("pinch", res.pinch.points)}
                        className="gap-1.5"
                      >
                        {copied === "pinch" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                        Copier
                      </Button>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Encadrement de l'obstacle</p>
                  </div>
                  <div className="px-5 py-4">
                    {res.pinch ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-trame)]/12 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-trame)] ring-1 ring-[var(--color-trame)]/30">
                          <AlertTriangle className="size-3" />
                          Obstacle évité (2 trous ajoutés)
                        </span>
                        <div className="mt-3">
                          <PositionList points={res.pinch.points} />
                        </div>
                        <dl className="mt-4 space-y-2 text-xs">
                          <SummaryRow label="Total trous" value={String(res.pinch.points.length)} strong />
                          <SummaryRow label="Pas conservé" value={`${fmt(res.base.pitch)} mm`} />
                          <SummaryRow label="Cotes encadrantes" value={`${fmt(res.low)} / ${fmt(res.high)} mm`} />
                        </dl>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Les cotes de sécurité ({fmt(res.low)} / {fmt(res.high)} mm) ne sont pas des entiers exacts :
                        ajustez la position de l'obstacle ou la marge, ou décochez « Mesures entières uniquement ».
                      </p>
                    )}
                  </div>
                </div>

                {/* Solution 2 */}
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="border-b border-border px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">Solution 2 — Répartition recalculée</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!res.recalc}
                        onClick={() => res.recalc && copy("recalc", res.recalc.points)}
                        className="gap-1.5"
                      >
                        {copied === "recalc" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                        Copier
                      </Button>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Sans trou doublé</p>
                  </div>
                  <div className="px-5 py-4">
                    {res.recalc ? (
                      <>
                        <PositionList points={res.recalc.points} />
                        <dl className="mt-4 space-y-2 text-xs">
                          <SummaryRow label="Intervalles" value={String(res.recalc.intervals)} />
                          <SummaryRow label="Nouveau pas exact" value={`${fmt(res.recalc.pitch)} mm`} strong />
                          <SummaryRow label="Total trous" value={String(res.recalc.points.length)} />
                        </dl>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {integers
                          ? "Aucune répartition entière n'évite la zone d'exclusion."
                          : `Aucune répartition régulière n'évite la zone d'exclusion (limite de ${MAX_INTERVALS} intervalles).`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
