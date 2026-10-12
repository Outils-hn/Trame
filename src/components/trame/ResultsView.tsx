import { useEffect, useState, type ReactNode } from "react";
import { Check, ClipboardList, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cadPitch, fmt, piecesTable, type DrillOption } from "@/lib/trame-calc";

/**
 * Tableau compact des possibilites (une ligne par repartition, sans les cotes)
 * + panneau de detail de la ligne choisie : schema, cotes cumulees, bouton Copier.
 */
export function ResultsView({
  title,
  options,
  integers,
  totalLength,
  empty,
  copy,
  copiedIdx,
  notice,
}: {
  title: string;
  options: DrillOption[];
  integers: boolean;
  totalLength: number;
  empty: ReactNode;
  copy: (positions: number[], idx: number, label: string, useIntegers: boolean) => void;
  copiedIdx: number | null;
  /** Message sous le tableau (ex. pieces sans solution). */
  notice?: ReactNode;
}) {
  const [selected, setSelected] = useState(0);
  // Si la liste raccourcit (nouvelles valeurs), on reste sur une ligne existante.
  useEffect(() => {
    if (selected >= options.length) setSelected(0);
  }, [options.length, selected]);

  if (!options.length) return <>{empty}</>;
  const sel = options[Math.min(selected, options.length - 1)]!;
  const showNotes = options.some((o) => o.note);
  // Mode plusieurs pieces : une ligne par piece, avec son repere et sa longueur.
  const multi = options.some((o) => o.mark !== undefined);
  const total = sel.length ?? totalLength;

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">{title}</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {multi
                ? `${options.length} pièce${options.length > 1 ? "s" : ""}`
                : `${options.length} possibilité${options.length > 1 ? "s" : ""}`}{" "}
              · cliquez une ligne pour le détail
            </span>
            {multi && (
              <CopyButton text={piecesTable(options)} done="Tableau copié, collez-le dans Excel" title="Copier le tableau pour Excel">
                <ClipboardList className="size-3.5" /> Tableau
              </CopyButton>
            )}
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground">
              <tr>
                {multi && <th className="px-4 py-2.5 text-left">Repère</th>}
                {multi && <th className="px-4 py-2.5 text-right">Longueur</th>}
                <th className="px-4 py-2.5 text-right">Intervalles</th>
                <th className="px-4 py-2.5 text-right">Perçages</th>
                <th className="px-4 py-2.5 text-right">Bord début</th>
                <th className="px-4 py-2.5 text-right">Entraxe</th>
                <th className="px-4 py-2.5 text-right">Bord fin</th>
                <th className="px-4 py-2.5 text-left">{showNotes ? "Option" : ""}</th>
              </tr>
            </thead>
            <tbody>
              {options.map((o, i) => {
                const active = i === selected;
                return (
                  <tr
                    key={i}
                    onClick={() => setSelected(i)}
                    aria-selected={active}
                    className={cn(
                      "cursor-pointer border-b border-border/60 last:border-0 transition-colors",
                      active ? "bg-[var(--color-trame)]/10" : "hover:bg-muted/50",
                    )}
                  >
                    {multi && (
                      <td className={cn("px-4 py-2.5 text-left font-medium", active && "shadow-[inset_3px_0_0_var(--color-trame)]")}>{o.mark}</td>
                    )}
                    {multi && <td className="px-4 py-2.5 text-right tabular-nums">{fmt(o.length ?? 0)}</td>}
                    <td className={cn("px-4 py-2.5 text-right tabular-nums", !multi && active && "shadow-[inset_3px_0_0_var(--color-trame)]")}>{o.N}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{o.holes}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmt(o.dStart)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-[var(--color-trame)]">{fmt(o.pitch)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmt(o.dEnd)}</td>
                    <td className="px-4 py-2.5 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        {o.round && (
                          <span className="rounded-full border border-[var(--color-trame)]/40 px-2 py-0.5 text-[10px] font-medium text-[var(--color-trame)]">
                            mm ronds
                          </span>
                        )}
                        {o.note && <span className="text-xs text-muted-foreground">{o.note}</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {notice && <div className="mt-2 text-xs text-muted-foreground">{notice}</div>}
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          {multi && (
            <span className="text-xl font-semibold">
              {sel.mark} <span className="text-sm font-normal text-muted-foreground tabular-nums">· {fmt(total)} mm</span>
            </span>
          )}
          <span className="text-xl font-semibold tabular-nums">{sel.holes} perçages</span>
          <span className="text-xl font-semibold tabular-nums text-[var(--color-trame)]">entraxe {fmt(sel.pitch)} mm</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            distances au bord {fmt(sel.dStart)} / {fmt(sel.dEnd)} mm
          </span>
        </div>

        <BarSchema positions={sel.positions} total={total} />

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Cotes cumulées depuis le bord de début (mm)</div>
            <div className="flex flex-wrap gap-1.5 text-sm tabular-nums">
              {sel.positions.map((p, i) => (
                <span key={i} className="rounded border border-border px-1.5 py-0.5">
                  {fmt(p, 1)}
                </span>
              ))}
            </div>
          </div>
          <Button
            onClick={() => copy(sel.positions, selected, multi ? `${sel.mark} · ${sel.holes} perçages` : `${sel.holes} perçages`, integers)}
            className="gap-1.5 bg-[var(--color-trame)] text-white hover:bg-[var(--color-trame)]/90"
          >
            {copiedIdx === selected ? <Check className="size-4" /> : <Copy className="size-4" />}
            Copier les cotes
          </Button>
        </div>

        {sel.holes > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Dans AutoCAD</span>
            <span>
              COPIER → <b className="font-medium text-foreground">Réseau</b> → {sel.holes} éléments →
            </span>
            <code className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-foreground">{cadPitch(sel.pitch)}</code>
            <CopyButton text={cadPitch(sel.pitch)} done={`${cadPitch(sel.pitch)} copié`} title="Copier la saisie AutoCAD">
              <Copy className="size-3.5" />
            </CopyButton>
            <span className="text-[11px]">&lt;90 pour une pièce verticale</span>
          </div>
        )}
      </section>
    </div>
  );
}

/** Petit bouton qui copie un texte et confirme 1,5 s. */
function CopyButton({ text, done, title, children }: { text: string; done: string; title: string; children: ReactNode }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          toast.success(done);
          setTimeout(() => setOk(false), 1500);
        } catch {
          toast.error("Impossible de copier");
        }
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-[var(--color-trame)] hover:text-[var(--color-trame)]"
    >
      {ok ? <Check className="size-3.5" /> : children}
    </button>
  );
}

/** Schema de controle : la piece, ses percages et les deux distances au bord. */
function BarSchema({ positions, total }: { positions: number[]; total: number }) {
  if (!(total > 0)) return null;
  const W = 700, x0 = 20, x1 = W - 20, y = 30;
  const X = (v: number) => x0 + (v / total) * (x1 - x0);
  const first = positions[0], last = positions[positions.length - 1];
  return (
    <svg viewBox={`0 0 ${W} 74`} className="mt-4 w-full" role="img" aria-label="Schéma des perçages">
      <rect x={x0} y={y - 10} width={x1 - x0} height={20} rx={3} className="fill-muted stroke-border" />
      {positions.length <= 80
        ? positions.map((p, i) => <circle key={i} cx={X(p)} cy={y} r={3.5} className="fill-foreground" />)
        : <text x={W / 2} y={y + 4} textAnchor="middle" className="fill-muted-foreground text-[11px]">{positions.length} perçages</text>}
      {first !== undefined && last !== undefined && (
        <g className="fill-muted-foreground text-[11px]">
          <text x={x0} y={66}>← {fmt(first)}</text>
          <text x={W / 2} y={66} textAnchor="middle">Longueur {fmt(total)} mm</text>
          <text x={x1} y={66} textAnchor="end">{fmt(total - last)} →</text>
        </g>
      )}
    </svg>
  );
}
