import { useMemo, useState } from "react";
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

export type PanelPattern = "perimeter" | "grid";

export interface PanelHole {
  x: number;
  y: number;
  zone: string;
}

export interface PanelResult {
  ok: boolean;
  reason?: "invalid" | "nointeger";
  usableX: number;
  usableY: number;
  nx: number;
  ny: number;
  pitchX: number;
  pitchY: number;
  holes: PanelHole[];
}

const AXIS_LIMIT = 200;

function solveAxis(usable: number, pitchMax: number, integers: boolean): { n: number; pitch: number } | null {
  const nMin = Math.max(1, Math.ceil(usable / pitchMax));
  if (!integers) return { n: nMin, pitch: usable / nMin };
  if (!Number.isInteger(usable)) return null;
  for (let n = nMin; n <= AXIS_LIMIT; n++) {
    const p = usable / n;
    if (Number.isInteger(p)) return { n, pitch: p };
  }
  return null;
}

function zoneOf(ix: number, iy: number, nx: number, ny: number): string {
  const left = ix === 0;
  const right = ix === nx;
  const bottom = iy === 0;
  const top = iy === ny;
  if (bottom && left) return "Angle bas-gauche";
  if (bottom && right) return "Angle bas-droit";
  if (top && left) return "Angle haut-gauche";
  if (top && right) return "Angle haut-droit";
  if (bottom) return "Rive basse";
  if (top) return "Rive haute";
  if (left) return "Rive gauche";
  if (right) return "Rive droite";
  return "Centre";
}

export function computePanel(
  X: number,
  Y: number,
  mxs: number,
  mxe: number,
  mys: number,
  mye: number,
  pitchMaxX: number,
  pitchMaxY: number,
  pattern: PanelPattern,
  integers: boolean,
): PanelResult {
  const empty: PanelResult = {
    ok: false,
    reason: "invalid",
    usableX: NaN,
    usableY: NaN,
    nx: 0,
    ny: 0,
    pitchX: NaN,
    pitchY: NaN,
    holes: [],
  };
  if (![X, Y, mxs, mxe, mys, mye, pitchMaxX, pitchMaxY].every((v) => isFinite(v) && v >= 0)) return empty;
  if (pitchMaxX <= 0 || pitchMaxY <= 0) return empty;

  const usableX = X - mxs - mxe;
  const usableY = Y - mys - mye;
  if (usableX <= 0 || usableY <= 0) return empty;

  if (integers && ![mxs, mys, X - mxe, Y - mye].every((v) => Number.isInteger(v))) {
    return { ...empty, reason: "nointeger" };
  }

  const ax = solveAxis(usableX, pitchMaxX, integers);
  const ay = solveAxis(usableY, pitchMaxY, integers);
  if (!ax || !ay) return { ...empty, reason: "nointeger", usableX, usableY };

  const holes: PanelHole[] = [];
  let n = 0;
  for (let iy = 0; iy <= ay.n; iy++) {
    for (let ix = 0; ix <= ax.n; ix++) {
      const onPerimeter = ix === 0 || ix === ax.n || iy === 0 || iy === ay.n;
      if (pattern === "perimeter" && !onPerimeter) continue;
      holes.push({
        x: mxs + ix * ax.pitch,
        y: mys + iy * ay.pitch,
        zone: zoneOf(ix, iy, ax.n, ay.n),
      });
      n++;
    }
  }

  return {
    ok: true,
    usableX,
    usableY,
    nx: ax.n,
    ny: ay.n,
    pitchX: ax.pitch,
    pitchY: ay.pitch,
    holes,
  };
}

export function PanelModule({
  integers,
  setIntegers,
  EmptyNotice,
}: {
  integers: boolean;
  setIntegers: (v: boolean) => void;
  EmptyNotice: React.ComponentType<{ message: string; onShowDecimals: () => void }>;
}) {
  const [X, setX] = useState<number>(1200);
  const [Y, setY] = useState<number>(2400);
  const [mxs, setMxs] = useState<number>(50);
  const [mxe, setMxe] = useState<number>(50);
  const [sameX, setSameX] = useState(true);
  const [mys, setMys] = useState<number>(50);
  const [mye, setMye] = useState<number>(50);
  const [sameY, setSameY] = useState(true);
  const [pitchMaxX, setPitchMaxX] = useState<number>(400);
  const [pitchMaxY, setPitchMaxY] = useState<number>(600);
  const [pattern, setPattern] = useState<PanelPattern>("perimeter");
  const [copied, setCopied] = useState(false);

  const effMxe = sameX ? mxs : mxe;
  const effMye = sameY ? mys : mye;

  const res = useMemo(
    () => computePanel(X, Y, mxs, effMxe, mys, effMye, pitchMaxX, pitchMaxY, pattern, integers),
    [X, Y, mxs, effMxe, mys, effMye, pitchMaxX, pitchMaxY, pattern, integers],
  );

  const copy = async () => {
    const txt = res.holes
      .map((h) => `${Number(h.x.toFixed(1))},${Number(h.y.toFixed(1))}`)
      .join("; ");
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      toast.success("Coordonnées copiées (X,Y)");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Dimensions du panneau</h2>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">2D</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="pX" label="Largeur totale (X)" value={isFinite(X) ? X : ""} onChange={setX} />
            <NumberField id="pY" label="Hauteur totale (Y)" value={isFinite(Y) ? Y : ""} onChange={setY} />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Rives périmétriques</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <NumberField id="pMxs" label="Rive X début" value={isFinite(mxs) ? mxs : ""} onChange={setMxs} />
              <NumberField
                id="pMxe"
                label="Rive X fin"
                value={sameX ? (isFinite(mxs) ? mxs : "") : isFinite(mxe) ? mxe : ""}
                onChange={setMxe}
                disabled={sameX}
              />
            </div>
            <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
              <span className="text-xs font-medium text-foreground">Rives X identiques</span>
              <Switch checked={sameX} onCheckedChange={setSameX} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <NumberField id="pMys" label="Rive Y début" value={isFinite(mys) ? mys : ""} onChange={setMys} />
              <NumberField
                id="pMye"
                label="Rive Y fin"
                value={sameY ? (isFinite(mys) ? mys : "") : isFinite(mye) ? mye : ""}
                onChange={setMye}
                disabled={sameY}
              />
            </div>
            <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
              <span className="text-xs font-medium text-foreground">Rives Y identiques</span>
              <Switch checked={sameY} onCheckedChange={setSameY} />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Contraintes d'entraxe</h2>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id="pPx"
              label="Pas max en X"
              value={isFinite(pitchMaxX) ? pitchMaxX : ""}
              onChange={setPitchMaxX}
            />
            <NumberField
              id="pPy"
              label="Pas max en Y"
              value={isFinite(pitchMaxY) ? pitchMaxY : ""}
              onChange={setPitchMaxY}
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Schéma de perçage</h2>
          <div className="inline-flex w-full rounded-md border border-border bg-muted/40 p-1">
            {(
              [
                ["perimeter", "Périmètre"],
                ["grid", "Grille complète"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setPattern(v)}
                className={cn(
                  "flex-1 rounded px-3 py-2 text-xs font-semibold transition-colors",
                  pattern === v
                    ? "bg-[var(--color-trame)] text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="mt-4 flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
            <span className="text-xs font-medium text-foreground">Mesures entières uniquement</span>
            <Switch checked={integers} onCheckedChange={setIntegers} />
          </label>
        </section>

        <section className="rounded-xl border border-border bg-muted/40 p-5">
          <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Résumé</h2>
          <dl className="space-y-2 text-xs">
            <SummaryRow label="Longueur utile X" value={`${fmt(res.usableX)} mm`} />
            <SummaryRow label="Longueur utile Y" value={`${fmt(res.usableY)} mm`} />
            <div className="my-2 h-px bg-border" />
            <SummaryRow
              label="Matrice"
              value={res.ok ? `${res.nx + 1} × ${res.ny + 1}` : "—"}
              strong
            />
          </dl>
        </section>
      </aside>

      <section>
        {!res.ok ? (
          res.reason === "nointeger" ? (
            <EmptyNotice
              message="Aucune répartition entière trouvée en X et en Y pour ce panneau."
              onShowDecimals={() => setIntegers(false)}
            />
          ) : (
            <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center text-sm text-muted-foreground">
              Saisissez des dimensions cohérentes (rives plus courtes que le panneau).
            </div>
          )
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Total perçages" value={String(res.holes.length)} />
              <StatCard label="Pas calculé en X" value={`${fmt(res.pitchX)} mm`} accent />
              <StatCard label="Pas calculé en Y" value={`${fmt(res.pitchY)} mm`} accent />
              <StatCard label="Matrice" value={`${res.nx + 1} × ${res.ny + 1}`} />
              <StatCard label="Intervalles X" value={String(res.nx)} />
              <StatCard label="Intervalles Y" value={String(res.ny)} />
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold">Coordonnées des perçages</h2>
                <Button variant="outline" size="sm" onClick={copy} className="gap-1.5">
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copier liste (X,Y)
                </Button>
              </div>

              <div className="hidden grid-cols-[70px_1fr_1fr_1.4fr] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid">
                <div>N° trou</div>
                <div>Position X</div>
                <div>Position Y</div>
                <div>Zone</div>
              </div>

              <ul>
                {res.holes.map((h, idx) => (
                  <li
                    key={`${h.x}-${h.y}-${idx}`}
                    className={cn(
                      "grid gap-2 border-b border-gray-300 px-5 py-2.5 dark:border-zinc-700 md:grid-cols-[70px_1fr_1fr_1.4fr] md:items-center md:gap-4",
                      idx % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-slate-100 dark:bg-zinc-800",
                    )}
                  >
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">{idx + 1}</span>
                    <span className="font-mono text-sm font-semibold tabular-nums">{fmt(h.x)} mm</span>
                    <span className="font-mono text-sm font-semibold tabular-nums">{fmt(h.y)} mm</span>
                    <span
                      className={cn(
                        "text-xs",
                        h.zone === "Centre" ? "text-muted-foreground" : "font-medium text-[var(--color-trame)]",
                      )}
                    >
                      {h.zone}
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
