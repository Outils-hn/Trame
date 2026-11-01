import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Aide } from "./Aide";
import { Check, ClipboardList, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cadPitch, chainText, fmt, piecesTable, type DrillOption } from "@/lib/trame-calc";

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
  recommendFirst,
  defaultIndex = 0,
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
  /** Badge "conseillé" sur la premiere ligne (le moins de percages sous l'entraxe max). */
  recommendFirst?: boolean;
  /** Ligne choisie d'office (ex. l'entraxe le plus rond). */
  defaultIndex?: number;
}) {
  const [selected, setSelected] = useState(defaultIndex);
  // Clavier : Tab amene sur la ligne choisie, fleches haut/bas pour changer, Entree pour copier les cotes
  const lignes = useRef<(HTMLTableRowElement | null)[]>([]);
  const auClavier = (e: KeyboardEvent<HTMLTableSectionElement>) => {
    const dernier = options.length - 1;
    const cible = e.key === "ArrowDown" ? Math.min(dernier, selected + 1)
      : e.key === "ArrowUp" ? Math.max(0, selected - 1)
      : e.key === "Home" ? 0 : e.key === "End" ? dernier : null;
    if (cible !== null) { e.preventDefault(); setSelected(cible); lignes.current[cible]?.focus(); return; }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const o = options[selected];
      if (o) copy(o.positions, selected, o.mark !== undefined ? `${o.mark} · ${o.holes} perçages` : `${o.holes} perçages`, integers);
    }
  };
  // Nouvelles valeurs saisies (autres entraxes) : on revient sur la ligne choisie d'office.
  const signature = options.map((o) => `${o.pitch}|${o.N}`).join(";");
  useEffect(() => {
    setSelected(Math.min(defaultIndex, Math.max(0, options.length - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

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
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">{title}</h2>
          <div className="flex items-center gap-3">
            {/* Fond leger : les points du fond ne passent pas derriere le texte */}
            <span className="rounded-md bg-background px-2 py-0.5 text-xs text-muted-foreground">
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
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm" role="grid" aria-label={`${title} : flèches haut et bas pour choisir, Entrée pour copier les cotes`}>
            <thead className="border-b border-foreground text-[12px] font-medium text-muted-foreground">
              <tr>
                {multi && <th className="px-4 py-2.5 text-left">Repère</th>}
                {multi && <th className="px-4 py-2.5 text-right">Longueur</th>}
                <th className="px-4 py-2.5 text-right">Intervalles</th>
                <th className="px-4 py-2.5 text-right">Perçages</th>
                <th className="px-4 py-2.5 text-right">Bord début</th>
                <th className="px-4 py-2.5 text-right">Entraxe</th>
                <th className="px-4 py-2.5 text-right">Bord fin</th>
                <th className="px-4 py-2.5 text-left">{showNotes ? "Option" : <span className="sr-only">Option</span>}</th>
              </tr>
            </thead>
            <tbody onKeyDown={auClavier}>
              {options.map((o, i) => {
                const active = i === selected;
                return (
                  <tr
                    key={i}
                    ref={(el) => { lignes.current[i] = el; }}
                    tabIndex={active ? 0 : -1}
                    onClick={() => setSelected(i)}
                    aria-selected={active}
                    className={cn(
                      "cursor-pointer border-b border-border/60 outline-none last:border-0 transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-trame)]",
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
                        {recommendFirst && i === 0 && (
                          <Aide nom="Conseillé" texte="La répartition avec le moins de perçages qui reste sous l'entraxe maximum demandé.">
                            <span className="inline-block rounded-full bg-[var(--color-trame)] px-2 py-0.5 text-xs font-semibold text-white dark:text-zinc-950">
                              conseillé
                            </span>
                          </Aide>
                        )}
                        {o.round && (
                          <Aide nom="mm ronds" texte="L'entraxe tombe sur un nombre entier de millimètres : facile à tracer et à percer, sans décimales.">
                            <span className="inline-block rounded-full border border-[var(--color-trame)]/40 px-2 py-0.5 text-xs font-medium text-[var(--color-trame)]">
                              mm ronds
                            </span>
                          </Aide>
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
        {/* Repartition choisie (style Epure) : l'entraxe en grand, le reste en dessous */}
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {multi ? `${sel.mark} · ${fmt(total)} mm` : "Répartition choisie"}
          </p>
          <p className="mt-2 text-[52px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
            {fmt(sel.pitch)}<span className="text-2xl text-muted-foreground"> mm</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground tabular-nums">
            entraxe · <span className="font-medium text-foreground">{sel.holes} perçages</span> · bords {fmt(sel.dStart)} / {fmt(sel.dEnd)} mm
          </p>
        </div>

        <BarSchema positions={sel.positions} total={total} N={sel.N} pitch={sel.pitch} />

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-xs font-semibold text-muted-foreground">Cotes cumulées depuis le bord de début (mm)</div>
            <div className="flex flex-wrap gap-1.5 text-sm tabular-nums">
              {/* Au-dela de 200 cotes, on n'affiche que les premieres (sinon la page se fige) ;
                  « Copier les cotes » copie toujours la liste complete. */}
              {sel.positions.slice(0, MAX_COTES).map((p, i) => (
                <span key={i} className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[13px]">
                  {fmt(p, 1)}
                </span>
              ))}
              {sel.positions.length > MAX_COTES && (
                <span className="px-2 py-0.5 text-[13px] text-muted-foreground">
                  … et {fmt(sel.positions.length - MAX_COTES, 0)} autres (toutes copiées avec « Copier les cotes »)
                </span>
              )}
            </div>
          </div>
          <Button
            onClick={() => copy(sel.positions, selected, multi ? `${sel.mark} · ${sel.holes} perçages` : `${sel.holes} perçages`, integers)}
            className="gap-1.5 rounded-full bg-[var(--color-trame)] px-5 text-white dark:text-zinc-950 hover:bg-[var(--color-trame)]/90"
          >
            {copiedIdx === selected ? <Check className="size-4" /> : <Copy className="size-4" />}
            Copier les cotes
          </Button>
        </div>

        {sel.holes > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">Dans AutoCAD</span>
              <span>
                COPIER → <b className="font-medium text-foreground">Réseau</b> → {sel.holes} éléments →
              </span>
              <code className={codeCls}>{cadPitch(sel.pitch)}</code>
              <CopyButton text={cadPitch(sel.pitch)} done={`${cadPitch(sel.pitch)} copié`} title="Copier la saisie AutoCAD">
                <Copy className="size-3.5" />
              </CopyButton>
              <span className="text-xs">&lt;90 pour une pièce verticale</span>
            </span>
            {sel.N > 1 && (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span>Texte de cote</span>
                <code className={codeCls}>{chainText(sel.N, sel.pitch)}</code>
                <CopyButton text={chainText(sel.N, sel.pitch)} done={`« ${chainText(sel.N, sel.pitch)} » copié`} title="Copier le texte de cote">
                  <Copy className="size-3.5" />
                </CopyButton>
              </span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/** Nombre maximum de cotes affichees en puces. */
const MAX_COTES = 200;

/** Valeurs a coller : chasse fixe, sans ligature (sinon "<>" devient un losange). */
const codeCls = "rounded border border-border bg-background px-1.5 py-0.5 font-mono text-foreground [font-variant-ligatures:none]";

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
      className="copy-btn inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-[var(--color-trame)] hover:text-[var(--color-trame)]"
    >
      {ok ? <Check className="size-3.5" /> : children}
    </button>
  );
}

/** Schema facon plan : la piece, ses percages, une ligne de cotes en chaine et la cote totale. */
function BarSchema({ positions, total, N, pitch }: { positions: number[]; total: number; N: number; pitch: number }) {
  if (!(total > 0) || !positions.length) return null;
  const W = 760, x0 = 56, x1 = W - 56, yBar = 22, yChain = 62, yTotal = 92;
  const X = (v: number) => x0 + (v / total) * (x1 - x0);
  const first = positions[0]!, last = positions[positions.length - 1]!;
  const dEnd = total - last;
  // Points de la chaine : bord, premier percage, dernier percage, bord.
  const ticks = positions.length > 1 ? [0, first, last, total] : [0, first, total];
  const tick = (x: number, y: number) => <line x1={x - 4} y1={y + 4} x2={x + 4} y2={y - 4} className="stroke-foreground" strokeWidth={1.3} />;
  // Un texte de bord trop large pour son segment passe a l'exterieur de la piece.
  const edgeLabel = (a: number, b: number, value: number, side: "start" | "end") => {
    const txt = fmt(value);
    const fits = X(b) - X(a) >= txt.length * 7 + 10;
    const x = fits ? (X(a) + X(b)) / 2 : side === "start" ? X(a) - 8 : X(b) + 8;
    const anchor = fits ? "middle" : side === "start" ? "end" : "start";
    return <text x={x} y={yChain - 5} textAnchor={anchor} className="fill-foreground text-xs tabular-nums">{txt}</text>;
  };
  return (
    <svg viewBox={`0 0 ${W} 104`} className="mt-4 w-full" role="img" aria-label="Schéma des perçages coté">
      {/* lignes d'attache vers les cotes */}
      <g className="stroke-muted-foreground/50" strokeWidth={0.8}>
        {[0, total].map((v, i) => <line key={`b${i}`} x1={X(v)} y1={yBar + 12} x2={X(v)} y2={yTotal + 6} />)}
        {ticks.slice(1, -1).map((v, i) => <line key={`p${i}`} x1={X(v)} y1={yBar + 6} x2={X(v)} y2={yChain + 6} />)}
      </g>
      <rect x={x0} y={yBar - 10} width={x1 - x0} height={20} rx={3} className="fill-muted stroke-border" />
      {positions.length <= 80
        ? positions.map((p, i) => <circle key={i} cx={X(p)} cy={yBar} r={3.5} className="fill-foreground" />)
        : <text x={W / 2} y={yBar + 4} textAnchor="middle" className="fill-muted-foreground text-xs">{positions.length} perçages</text>}

      {/* cotes en chaine */}
      <line x1={X(0)} y1={yChain} x2={X(total)} y2={yChain} className="stroke-foreground" strokeWidth={0.8} />
      {ticks.map((v, i) => <g key={i}>{tick(X(v), yChain)}</g>)}
      {edgeLabel(0, first, first, "start")}
      {positions.length > 1 && (
        <text x={(X(first) + X(last)) / 2} y={yChain - 5} textAnchor="middle" className="fill-[var(--color-trame)] text-xs font-semibold tabular-nums">
          {N > 1 ? `${N} × ${fmt(pitch)} = ${fmt(last - first)}` : fmt(last - first)}
        </text>
      )}
      {edgeLabel(last, total, dEnd, "end")}

      {/* cote totale */}
      <line x1={X(0)} y1={yTotal} x2={X(total)} y2={yTotal} className="stroke-foreground" strokeWidth={0.8} />
      {tick(X(0), yTotal)}
      {tick(X(total), yTotal)}
      <text x={W / 2} y={yTotal - 5} textAnchor="middle" className="fill-foreground text-xs font-semibold tabular-nums">{fmt(total)}</text>
    </svg>
  );
}
