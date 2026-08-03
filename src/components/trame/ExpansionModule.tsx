import { useMemo, useRef, useState } from "react";
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

const AXIS_LIMIT = 200;
const EPS = 1e-9;

export type ExpansionMode = "bar" | "panel";
export type PfMode = "auto" | "manual";

export interface ExpansionHole {
  x: number;
  y: number;
  fixed: boolean;
}

export interface ExpansionResult {
  ok: boolean;
  reason?: "invalid" | "nointeger";
  holes: ExpansionHole[];
  pitchX: number;
  pitchY: number;
  nx: number;
  ny: number;
  usableX: number;
  usableY: number;
  fixedIndex: number;
}

function solveAxis(usable: number, pitchMax: number, integers: boolean): { n: number; pitch: number } | null {
  if (!isFinite(usable) || usable < 0 || !isFinite(pitchMax) || pitchMax <= 0) return null;
  if (usable === 0) return { n: 0, pitch: 0 };
  const nMin = Math.max(1, Math.ceil(usable / pitchMax - EPS));
  for (let n = nMin; n <= AXIS_LIMIT; n++) {
    const pitch = usable / n;
    if (integers && Math.abs(pitch - Math.round(pitch)) > 1e-6) continue;
    return { n, pitch: integers ? Math.round(pitch) : pitch };
  }
  return null;
}

export function computeExpansion(
  mode: ExpansionMode,
  X: number,
  Y: number,
  mxs: number,
  mxe: number,
  mys: number,
  mye: number,
  pitchMaxX: number,
  pitchMaxY: number,
  pfMode: PfMode,
  pfIndex: number,
  integers: boolean,
): ExpansionResult {
  const empty: ExpansionResult = {
    ok: false,
    reason: "invalid",
    holes: [],
    pitchX: NaN,
    pitchY: NaN,
    nx: 0,
    ny: 0,
    usableX: NaN,
    usableY: NaN,
    fixedIndex: -1,
  };

  const usableX = X - mxs - mxe;
  if (!isFinite(usableX) || usableX <= 0) return empty;
  if (integers && [X, mxs, mxe].some((v) => Math.abs(v - Math.round(v)) > 1e-6)) {
    return { ...empty, reason: "nointeger" };
  }
  const ax = solveAxis(usableX, pitchMaxX, integers);
  if (!ax) return { ...empty, reason: integers ? "nointeger" : "invalid" };

  let ay: { n: number; pitch: number } = { n: 0, pitch: 0 };
  let usableY = 0;
  if (mode === "panel") {
    usableY = Y - mys - mye;
    if (!isFinite(usableY) || usableY <= 0) return empty;
    if (integers && [Y, mys, mye].some((v) => Math.abs(v - Math.round(v)) > 1e-6)) {
      return { ...empty, reason: "nointeger" };
    }
    const solved = solveAxis(usableY, pitchMaxY, integers);
    if (!solved) return { ...empty, reason: integers ? "nointeger" : "invalid" };
    ay = solved;
  }

  const holes: ExpansionHole[] = [];
  if (mode === "bar") {
    for (let i = 0; i <= ax.n; i++) holes.push({ x: mxs + i * ax.pitch, y: 0, fixed: false });
  } else {
    for (let iy = 0; iy <= ay.n; iy++) {
      for (let ix = 0; ix <= ax.n; ix++) {
        holes.push({ x: mxs + ix * ax.pitch, y: mys + iy * ay.pitch, fixed: false });
      }
    }
  }
  if (!holes.length) return empty;

  let fixedIndex: number;
  if (pfMode === "auto") {
    if (mode === "bar") {
      fixedIndex = Math.floor(ax.n / 2);
    } else {
      const cx = Math.floor(ax.n / 2);
      const cy = Math.floor(ay.n / 2);
      fixedIndex = cy * (ax.n + 1) + cx;
    }
  } else {
    fixedIndex = Math.min(Math.max(Math.round(pfIndex) - 1, 0), holes.length - 1);
  }
  holes[fixedIndex]!.fixed = true;

  return {
    ok: true,
    holes,
    pitchX: ax.pitch,
    pitchY: ay.pitch,
    nx: ax.n,
    ny: ay.n,
    usableX,
    usableY,
    fixedIndex,
  };
}

/* ------------------------------- Schéma SVG ------------------------------- */

function ExpansionSchematic({
  mode,
  X,
  Y,
  res,
  hovered,
  setHovered,
}: {
  mode: ExpansionMode;
  X: number;
  Y: number;
  res: ExpansionResult;
  hovered: number | null;
  setHovered: (i: number | null) => void;
}) {
  const barH = X * 0.14;
  const H = mode === "bar" ? barH : Y;
  const span = Math.max(X, H);
  const pad = span * 0.13;
  const u = span / 400;
  const fontXS = span * 0.021;
  const py = (y: number) => (mode === "bar" ? H / 2 : H - y);
  const r = span * 0.011;
  const hov = hovered != null ? res.holes[hovered] : null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold">Schéma points fixes / glissants</h2>
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full bg-[var(--color-trame)] ring-2 ring-[var(--color-trame)]/35" />
            Point fixe
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full bg-slate-500" />
            Point glissant
          </span>
        </div>
      </div>
      <div className="px-5 py-5">
        <svg
          viewBox={`${-pad} ${-pad} ${X + 2 * pad} ${H + 2 * pad}`}
          className="mx-auto block h-auto w-full max-w-[620px]"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Schéma des points fixes et glissants"
        >
          <rect
            x={0}
            y={0}
            width={X}
            height={H}
            rx={span * 0.008}
            className="fill-slate-100 stroke-slate-400 dark:fill-zinc-800 dark:stroke-zinc-600"
            strokeWidth={u * 1.6}
          />

          {res.holes.map((h, i) => {
            const cx = h.x;
            const cy = py(h.y);
            const active = hovered === i;
            if (h.fixed) {
              return (
                <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                  <circle cx={cx} cy={cy} r={r * 3.4} fill="transparent" />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r * 2.6}
                    fill="none"
                    stroke="var(--color-trame)"
                    strokeWidth={u * 1.1}
                    opacity={0.55}
                  />
                  <circle cx={cx} cy={cy} r={r * 1.7} fill="none" stroke="var(--color-trame)" strokeWidth={u * 1.4} />
                  <circle cx={cx} cy={cy} r={r * (active ? 1.15 : 0.95)} fill="var(--color-trame)" />
                </g>
              );
            }
            const a = r * 2.6;
            return (
              <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                <circle cx={cx} cy={cy} r={r * 3.2} fill="transparent" />
                <g
                    className="stroke-slate-400 dark:stroke-zinc-500"
                    strokeWidth={u * 0.9}
                    strokeLinecap="round"
                    fill="none"
                  >
                    <line x1={cx - a} y1={cy} x2={cx + a} y2={cy} />
                    <polyline points={`${cx - a + r * 0.9},${cy - r * 0.7} ${cx - a},${cy} ${cx - a + r * 0.9},${cy + r * 0.7}`} />
                    <polyline points={`${cx + a - r * 0.9},${cy - r * 0.7} ${cx + a},${cy} ${cx + a - r * 0.9},${cy + r * 0.7}`} />
                </g>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r * (active ? 1.25 : 0.9)}
                  className={cn(active ? "fill-[var(--color-trame)]" : "fill-slate-600 dark:fill-zinc-300")}
                />
              </g>
            );
          })}

          {hov &&
            hovered != null &&
            (() => {
              const label =
                mode === "bar"
                  ? `Trou N°${hovered + 1} : ${fmt(hov.x)} mm · ${hov.fixed ? "PF" : "PG"}`
                  : `Trou N°${hovered + 1} : X=${fmt(hov.x)}, Y=${fmt(hov.y)} · ${hov.fixed ? "PF" : "PG"}`;
              const w = label.length * fontXS * 0.62 + fontXS * 1.6;
              const hh = fontXS * 2.1;
              const bx = Math.min(Math.max(hov.x - w / 2, -pad * 0.6), X + pad * 0.6 - w);
              const by = py(hov.y) - span * 0.035 - hh;
              return (
                <g pointerEvents="none">
                  <rect
                    x={bx}
                    y={by}
                    width={w}
                    height={hh}
                    rx={hh * 0.25}
                    className="fill-slate-900 dark:fill-zinc-100"
                    opacity={0.95}
                  />
                  <text
                    x={bx + w / 2}
                    y={by + hh * 0.68}
                    textAnchor="middle"
                    fontSize={fontXS}
                    className="fill-white font-mono dark:fill-zinc-900"
                  >
                    {label}
                  </text>
                </g>
              );
            })()}
        </svg>
      </div>
    </div>
  );
}

/* --------------------------------- Module --------------------------------- */

export function ExpansionModule({
  integers,
  setIntegers,
  EmptyNotice,
}: {
  integers: boolean;
  setIntegers: (v: boolean) => void;
  EmptyNotice: React.ComponentType<{ message: string; onShowDecimals: () => void }>;
}) {
  const [mode, setMode] = useState<ExpansionMode>("bar");
  const [X, setX] = useState<number>(3094);
  const [Y, setY] = useState<number>(2400);
  const [mxs, setMxs] = useState<number>(50);
  const [mxe, setMxe] = useState<number>(50);
  const [sameX, setSameX] = useState(true);
  const [mys, setMys] = useState<number>(50);
  const [mye, setMye] = useState<number>(50);
  const [sameY, setSameY] = useState(true);
  const [pitchMaxX, setPitchMaxX] = useState<number>(400);
  const [pitchMaxY, setPitchMaxY] = useState<number>(600);
  const [pfMode, setPfMode] = useState<PfMode>("auto");
  const [pfIndex, setPfIndex] = useState<number>(1);
  const [dScrew, setDScrew] = useState<number>(5.5);
  const [dHole, setDHole] = useState<number>(8.5);
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  const effMxe = sameX ? mxs : mxe;
  const effMye = sameY ? mys : mye;

  const res = useMemo(
    () =>
      computeExpansion(
        mode,
        X,
        Y,
        mxs,
        effMxe,
        mys,
        effMye,
        pitchMaxX,
        pitchMaxY,
        pfMode,
        pfIndex,
        integers,
      ),
    [mode, X, Y, mxs, effMxe, mys, effMye, pitchMaxX, pitchMaxY, pfMode, pfIndex, integers],
  );

  const jeu = (dHole - dScrew) / 2;
  const total = res.holes.length;
  const sliding = Math.max(total - 1, 0);

  const copy = async () => {
    const txt = res.holes
      .map((h, i) => {
        const pos = mode === "bar" ? `${Number(h.x.toFixed(1))}` : `${Number(h.x.toFixed(1))},${Number(h.y.toFixed(1))}`;
        return `${i + 1}: ${pos} ${h.fixed ? `PF Ø${fmt(dScrew)}` : `PG Ø${fmt(dHole)}`}`;
      })
      .join("; ");
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      toast.success("Liste PF/PG copiée");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Type de support</h2>
          <div className="inline-flex w-full rounded-md border border-border bg-muted/40 p-1">
            {(
              [
                ["bar", "Barre 1D"],
                ["panel", "Panneau 2D"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setMode(v)}
                className={cn(
                  "flex-1 rounded px-3 py-2 text-xs font-semibold transition-colors",
                  mode === v ? "bg-[var(--color-trame)] text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">{mode === "bar" ? "Barre" : "Panneau"}</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                id="dX"
                label={mode === "bar" ? "Longueur (L)" : "Largeur (X)"}
                value={isFinite(X) ? X : ""}
                onChange={setX}
              />
              {mode === "panel" ? (
                <NumberField id="dY" label="Hauteur (Y)" value={isFinite(Y) ? Y : ""} onChange={setY} />
              ) : (
                <NumberField
                  id="dPx"
                  label="Pas max"
                  value={isFinite(pitchMaxX) ? pitchMaxX : ""}
                  onChange={setPitchMaxX}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                id="dMxs"
                label={mode === "bar" ? "Distance début" : "Rive X début"}
                value={isFinite(mxs) ? mxs : ""}
                onChange={setMxs}
              />
              <NumberField
                id="dMxe"
                label={mode === "bar" ? "Distance fin" : "Rive X fin"}
                value={sameX ? (isFinite(mxs) ? mxs : "") : isFinite(mxe) ? mxe : ""}
                onChange={setMxe}
                disabled={sameX}
              />
            </div>
            <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
              <span className="text-xs font-medium text-foreground">Identique au début</span>
              <Switch checked={sameX} onCheckedChange={setSameX} />
            </label>

            {mode === "panel" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField id="dMys" label="Rive Y début" value={isFinite(mys) ? mys : ""} onChange={setMys} />
                  <NumberField
                    id="dMye"
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
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    id="dPx2"
                    label="Pas max en X"
                    value={isFinite(pitchMaxX) ? pitchMaxX : ""}
                    onChange={setPitchMaxX}
                  />
                  <NumberField
                    id="dPy"
                    label="Pas max en Y"
                    value={isFinite(pitchMaxY) ? pitchMaxY : ""}
                    onChange={setPitchMaxY}
                  />
                </div>
              </>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Point fixe (PF)</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="dPf" className="text-xs font-medium text-muted-foreground">
                Sélection du point fixe
              </Label>
              <select
                id="dPf"
                value={pfMode}
                onChange={(e) => setPfMode(e.target.value as PfMode)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="auto">Automatique (Au centre - Recommandé DTU)</option>
                <option value="manual">Manuel (Choisir l'index du trou)</option>
              </select>
            </div>
            {pfMode === "manual" && (
              <NumberField
                id="dPfIdx"
                label={`Index du trou (1 – ${Math.max(total, 1)})`}
                value={isFinite(pfIndex) ? pfIndex : ""}
                onChange={setPfIndex}
                suffix="n°"
                step="1"
              />
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Contrainte dilatation</h2>
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="dVis" label="Ø vis" value={isFinite(dScrew) ? dScrew : ""} onChange={setDScrew} />
            <NumberField id="dTrou" label="Ø perçage PG" value={isFinite(dHole) ? dHole : ""} onChange={setDHole} />
          </div>
          <div className="mt-3 rounded-md border border-[var(--color-trame)]/30 bg-[var(--color-trame)]/10 px-3 py-2">
            <p className="text-xs text-muted-foreground">Jeu disponible par point glissant</p>
            <p className="font-mono text-sm font-semibold text-[var(--color-trame)]">
              {jeu > 0 ? `± ${fmt(jeu, 2)} mm` : "Ø perçage insuffisant"}
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Options</h2>
          <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
            <span className="text-xs font-medium text-foreground">Mesures entières uniquement</span>
            <Switch checked={integers} onCheckedChange={setIntegers} />
          </label>
        </section>
      </aside>

      <section className="space-y-6">
        {!res.ok ? (
          res.reason === "nointeger" ? (
            <EmptyNotice
              message="Aucune répartition entière trouvée pour cette configuration de dilatation."
              onShowDecimals={() => setIntegers(false)}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Renseignez des dimensions et des pas max valides.
            </div>
          )
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <StatCard label="Total perçages" value={String(total)} />
              <StatCard label="Points fixes" value="1" accent />
              <StatCard label="Points glissants" value={String(sliding)} />
              <StatCard
                label={mode === "bar" ? "Pas réel" : "Pas X × Pas Y"}
                value={mode === "bar" ? `${fmt(res.pitchX)} mm` : `${fmt(res.pitchX)} × ${fmt(res.pitchY)}`}
              />
            </div>

            <ExpansionSchematic
              mode={mode}
              X={X}
              Y={Y}
              res={res}
              hovered={hovered}
              setHovered={setHovered}
              svgRef={svgRef}
            />

            <ExportActions
              moduleName={mode === "bar" ? "Dilatation-barre" : "Dilatation-panneau"}
              subtitle={pfMode === "auto" ? "Point fixe automatique" : `Point fixe manuel N°${pfIndex}`}
              is2D={mode === "panel"}
              width={X}
              height={Y}
              holes={res.holes.map((h) => ({ x: h.x, y: h.y, dia: h.fixed ? dScrew : dHole }))}
              svgRef={svgRef}
              params={[
                { label: mode === "bar" ? "Longueur" : "Largeur X", value: `${fmt(X)} mm` },
                ...(mode === "panel" ? [{ label: "Hauteur Y", value: `${fmt(Y)} mm` }] : []),
                { label: mode === "bar" ? "Rives" : "Rives X", value: `${fmt(mxs)} / ${fmt(effMxe)} mm` },
                ...(mode === "panel" ? [{ label: "Rives Y", value: `${fmt(mys)} / ${fmt(effMye)} mm` }] : []),
                { label: "Pas X retenu", value: `${fmt(res.pitchX)} mm` },
                ...(mode === "panel" ? [{ label: "Pas Y retenu", value: `${fmt(res.pitchY)} mm` }] : []),
                { label: "Ø vis", value: `${fmt(dScrew, 2)} mm` },
                { label: "Ø perçage PG", value: `${fmt(dHole, 2)} mm` },
                { label: "Jeu par PG", value: `± ${fmt(jeu, 2)} mm` },
                { label: "Total trous", value: String(total) },
                { label: "PF / PG", value: `1 / ${sliding}` },
              ]}
              columns={["N°", mode === "bar" ? "Position (mm)" : "X / Y (mm)", "Type", "Ø recommandé"]}
              rows={res.holes.map((h, i) => [
                String(i + 1),
                mode === "bar" ? fmt(h.x) : `${fmt(h.x)} / ${fmt(h.y)}`,
                h.fixed ? "PF — Point fixe" : "PG — Point glissant",
                `Ø ${fmt(h.fixed ? dScrew : dHole, 2)} mm`,
              ])}
              notes={[
                `Point fixe : Ø ${fmt(dScrew, 2)} mm — perçage ajusté sans jeu.`,
                `Points glissants : Ø ${fmt(dHole, 2)} mm — coulisse ± ${fmt(jeu, 2)} mm.`,
              ]}
            />


            <div className="rounded-xl border border-[var(--color-trame)]/40 bg-[var(--color-trame)]/[0.07] p-5">
              <h2 className="text-sm font-semibold text-foreground">Synthèse atelier</h2>
              <p className="mt-2 font-mono text-sm text-foreground">
                1 trou de Ø {fmt(dScrew, 2)} mm (Point Fixe) + {sliding} trou{sliding > 1 ? "s" : ""} de Ø{" "}
                {fmt(dHole, 2)} mm (Points Glissants)
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Jeu de dilatation par point glissant : ± {fmt(jeu, 2)} mm · vis Ø {fmt(dScrew, 2)} mm.
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold">Cotes et typologie</h2>
                <Button variant="outline" size="sm" onClick={copy} className="h-8 gap-1.5 text-xs">
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copier la liste
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5 font-semibold">N° trou</th>
                      <th className="px-4 py-2.5 font-semibold">Position</th>
                      <th className="px-4 py-2.5 font-semibold">Type</th>
                      <th className="px-4 py-2.5 font-semibold">Ø perçage recommandé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.holes.map((h, i) => (
                      <tr
                        key={i}
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(null)}
                        className={cn(
                          "border-b border-border font-mono tabular-nums",
                          i % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-slate-100 dark:bg-zinc-800/70",
                          hovered === i && "bg-[var(--color-trame)]/10 dark:bg-[var(--color-trame)]/15",
                        )}
                      >
                        <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-2.5 font-semibold">
                          {mode === "bar" ? `${fmt(h.x)} mm` : `X ${fmt(h.x)} · Y ${fmt(h.y)}`}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              "inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                              h.fixed
                                ? "bg-[var(--color-trame)] text-white"
                                : "bg-muted text-muted-foreground ring-1 ring-border",
                            )}
                          >
                            {h.fixed ? "Point fixe" : "Point glissant"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">Ø {h.fixed ? fmt(dScrew, 2) : fmt(dHole, 2)} mm</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
