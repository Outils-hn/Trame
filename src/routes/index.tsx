import { createFileRoute } from "@tanstack/react-router";
import { SelecteurApplis } from "@/components/trame/SelecteurApplis";
import { useEffect, useMemo, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  buildMultiPieceOptions,
  buildPitchRows,
  fmt,
  fromIntervalRows,
  fromPitchRows,
  parsePieces,
  champsInvalides,
  indexPlusRond,
  type Mode,
} from "@/lib/trame-calc";
import {
  TrameHistoryProvider,
  useModuleHistory,
  type HistoryParams,
} from "@/lib/trame-history";



export const Route = createFileRoute("/")({
  // Rendu dans le navigateur uniquement : les reglages retenus sont lus des le depart
  ssr: false,
  head: () => ({
    meta: [
      { title: "Trame · Répartition de perçages" },
      {
        name: "description",
        content:
          "Trame — calculateur métier pour la répartition de perçages en façade : pas maximum, intervalles, positions cumulées.",
      },
    ],
  }),
  component: Index,
});




/** Lecture d'une saisie : virgule ou point, espaces et apostrophes suisses acceptes (« 2'737,5 »). */
function lireNombre(v: string): number {
  const c = v.replace(/[\s\u00a0\u202f'\u2019\u2018]/g, "").replace(",", ".");
  return c === "" || !/^-?\d*\.?\d+$/.test(c) ? NaN : Number(c);
}

/** Un champ par identifiant : en changeant de mode, React ne reutilise pas le champ d'un autre
 *  parametre (sinon la longueur du mode precedent restait affichee). */
function NumberField(props: Parameters<typeof ChampTrame>[0]) {
  return <ChampTrame key={props.id} {...props} />;
}

function ChampTrame({
  id,
  label,
  value,
  onChange,
  disabled,
  suffix = "mm",
  error,
}: {
  id: string;
  label: string;
  value: number | "";
  onChange: (v: number) => void;
  disabled?: boolean;
  suffix?: string;
  step?: string;
  /** Raison du refus : contour rouge et message sous le champ. */
  error?: string;
}) {
  // Meme format que les resultats : « 3 000 », « 2 737,5 » ; le texte tape est garde pendant la saisie
  const afficher = (v: number | "") => (v === "" || !Number.isFinite(v) ? "" : fmt(v, 3));
  const [texte, setTexte] = useState(() => afficher(value));
  const focus = useRef(false);
  useEffect(() => {
    if (!focus.current) setTexte(afficher(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={texte}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-erreur` : undefined}
          onFocus={(e) => { focus.current = true; e.target.select(); }}
          onBlur={() => { focus.current = false; const n = lireNombre(texte); if (Number.isFinite(n)) setTexte(afficher(n)); }}
          onChange={(e) => {
            setTexte(e.target.value);
            onChange(lireNombre(e.target.value));
          }}
          className={"h-11 pr-12 text-right text-base tabular-nums" + (error ? " border-destructive focus-visible:ring-destructive" : "")}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>
      {error && <p id={`${id}-erreur`} className="text-xs text-destructive">{error}</p>}
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

/**
 * Comme useState, mais la valeur est retenue dans le navigateur (cle « trame:etat:… », comprise
 * dans la sauvegarde complete) : on retrouve ses derniers reglages a la prochaine ouverture.
 * Une valeur abimee ou d'un autre type est ignoree.
 */
function useMemoire<T>(nom: string, defaut: T) {
  const cle = `trame:etat:${nom}`;
  const [valeur, setValeur] = useState<T>(() => {
    try {
      const brut = window.localStorage.getItem(cle);
      if (brut == null) return defaut;
      const lu = JSON.parse(brut) as unknown;
      return typeof lu === typeof defaut && (typeof lu !== "number" || Number.isFinite(lu)) ? (lu as T) : defaut;
    } catch {
      return defaut;
    }
  });
  useEffect(() => {
    try { window.localStorage.setItem(cle, JSON.stringify(valeur)); } catch { /* stockage bloque */ }
  }, [cle, valeur]);
  return [valeur, setValeur] as const;
}

function TrameApp() {
  const [dark, setDark] = useMemoire("dark", false);
  const [mode, setMode] = useMemoire<Mode>("mode", "intervals");

  // Mode 1 — intervals
  const [L, setL] = useMemoire<number>("L", 3000);
  const [Ds, setDs] = useMemoire<number>("Ds", 50);
  const [De, setDe] = useMemoire<number>("De", 50);
  const [sameEnd, setSameEnd] = useMemoire("sameEnd", true);
  const [maxIntervals, setMaxIntervals] = useMemoire<number>("maxIntervals", 5);

  // Mode 2 — fixed pitch
  const [L2, setL2] = useMemoire<number>("L2", 3000);
  const [E, setE] = useMemoire<number>("E", 100);
  const [symmetric, setSymmetric] = useMemoire("symmetric", true);
  const [Dstart, setDstart] = useMemoire<number>("Dstart", 50);
  const [minEdge2, setMinEdge2] = useMemoire<number>("minEdge2", 30);

  // Mode 3 — max pitch ceiling
  const [L3, setL3] = useMemoire<number>("L3", 3000);
  const [Ds3, setDs3] = useMemoire<number>("Ds3", 50);
  const [De3, setDe3] = useMemoire<number>("De3", 50);
  const [sameEnd3, setSameEnd3] = useMemoire("sameEnd3", true);
  const [Emax, setEmax] = useMemoire<number>("Emax", 300);
  const [autoRives3, setAutoRives3] = useMemoire("autoRives3", false);
  const [riveMin3, setRiveMin3] = useMemoire<number>("riveMin3", 30);
  // Plusieurs pieces (entraxe max uniquement) : liste Repere / Longueur, memes parametres.
  const [multi3, setMulti3] = useMemoire("multi3", false);
  const [pieces3, setPieces3] = useMemoire<string>("pieces3", "A1\t3000\nA2\t2450\nA3\t1830");

  const [integers, setIntegers] = useMemoire("integers", false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);


  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Curseur directement dans la longueur du mode choisi : on tape sans cliquer
  useEffect(() => {
    const id = mode === "intervals" ? "L" : mode === "pitch" ? "L2" : multi3 ? "pieces3" : "L3";
    const champ = document.getElementById(id) as HTMLInputElement | null;
    champ?.focus();
    if (champ instanceof HTMLInputElement) champ.select();
  }, [mode, multi3]);

  const effectiveDe = sameEnd ? Ds : De;

  const intervalsData = useMemo(
    () => buildIntervalRows(L, Ds, effectiveDe, maxIntervals, integers),
    [L, Ds, effectiveDe, maxIntervals, integers],
  );

  const pitchRows = useMemo(
    () => buildPitchRows(L2, E, symmetric, Dstart, false, minEdge2),
    [L2, E, symmetric, Dstart, minEdge2],
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

  const parsed3 = useMemo(() => parsePieces(pieces3), [pieces3]);
  const multiData = useMemo(
    () =>
      buildMultiPieceOptions(parsed3.pieces, {
        auto: autoRives3, Ds: Ds3, De: effectiveDe3, Emax, minEdge: riveMin3, symmetric: sameEnd3, integers,
      }),
    [parsed3, autoRives3, Ds3, effectiveDe3, Emax, riveMin3, sameEnd3, integers],
  );
  const isMulti = mode === "maxpitch" && multi3;
  // Champs a corriger : contour rouge + raison sous le champ, au lieu d'un message general
  const erreurs = champsInvalides(mode, { L, Ds, De: effectiveDe, maxIntervals, L2, E, symmetric, Dstart, minEdge2, L3, Ds3, De3: effectiveDe3, Emax, autoRives3, riveMin3, multi3 });
  const premiereErreur = Object.values(erreurs)[0];

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
    if (p.minEdge2 !== undefined) setMinEdge2(Number(p.minEdge2));
    setL3(Number(p.L3));
    setDs3(Number(p.Ds3));
    setDe3(Number(p.De3));
    setSameEnd3(Boolean(p.sameEnd3));
    setEmax(Number(p.Emax));
    setAutoRives3(Boolean(p.autoRives3));
    if (p.riveMin3 !== undefined) setRiveMin3(Number(p.riveMin3));
    setMulti3(Boolean(p.multi3));
    if (typeof p.pieces3 === "string") setPieces3(p.pieces3);
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
    minEdge2,
    L3,
    Ds3,
    De3,
    sameEnd3,
    Emax,
    autoRives3,
    riveMin3,
    multi3,
    pieces3,
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
        isMulti ? `Pièce ${label}` : `Barre ${fmt(total, 1)} mm — ${positions.length} trous`,
        snapshot(),
      );
      toast.success(`Cotes copiées (${label})`);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  return (
    <div className="min-h-screen text-foreground">
      <Toaster richColors position="top-right" />
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <TrameMark />
            <SelecteurApplis />
            <span className="sr-only">Répartition de perçages</span>
          </div>
          <div className="flex items-center gap-2">
          <HistoryButton />
          <button
            onClick={() => setDark((d) => !d)}
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl bg-muted p-1 sm:w-auto sm:inline-grid">

            <TabsTrigger
              aria-controls="trame-panneau"
              value="intervals"
              className="h-9 rounded-lg px-4 text-[13px] text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <span className="sm:hidden">Intervalles</span>
              <span className="hidden sm:inline">Par nombre d'intervalles</span>
            </TabsTrigger>
            <TabsTrigger
              aria-controls="trame-panneau"
              value="pitch"
              className="h-9 rounded-lg px-4 text-[13px] text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <span className="sm:hidden">Entraxe fixe</span>
              <span className="hidden sm:inline">Par entraxe fixe</span>
            </TabsTrigger>
            <TabsTrigger
              aria-controls="trame-panneau"
              value="maxpitch"
              className="h-9 rounded-lg px-4 text-[13px] text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <span className="sm:hidden">Entraxe max</span>
              <span className="hidden sm:inline">Par entraxe maximum</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Panneau des onglets (les onglets n'ont pas de contenu Radix : on les relie ici, pour l'accessibilite) */}
        <div id="trame-panneau" role="tabpanel" className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
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
                    <NumberField error={erreurs["L"]} id="L" label="Longueur totale (L)" value={isFinite(L) ? L : ""} onChange={setL} />

                    <div className="grid grid-cols-2 gap-3">
                      <NumberField error={erreurs["ds"]} id="ds" label="Distance au bord début" value={isFinite(Ds) ? Ds : ""} onChange={setDs} />
                      <NumberField
                        id="de"
                        error={erreurs["de"]}
                        label="Distance au bord fin"
                        value={sameEnd ? (isFinite(Ds) ? Ds : "") : isFinite(De) ? De : ""}
                        onChange={setDe}
                        disabled={sameEnd}
                      />
                    </div>

                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
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
                      error={erreurs["pm"]}
                      label="Intervalles max"
                      value={isFinite(maxIntervals) ? maxIntervals : ""}
                      onChange={setMaxIntervals}
                      suffix="int."
                      step="1"
                    />
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
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
                    <NumberField error={erreurs["L2"]} id="L2" label="Longueur totale (L)" value={isFinite(L2) ? L2 : ""} onChange={setL2} />
                    <NumberField error={erreurs["E"]} id="E" label="Entraxe imposé (E)" value={isFinite(E) ? E : ""} onChange={setE} />

                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
                      <span className="text-xs font-medium text-foreground">Distances au bord identiques</span>
                      <Switch checked={symmetric} onCheckedChange={setSymmetric} />
                    </label>

                    {!symmetric && (
                      <NumberField
                        id="dstart"
                        error={erreurs["dstart"]}
                        label="Distance au bord début"
                        value={isFinite(Dstart) ? Dstart : ""}
                        onChange={setDstart}
                      />
                    )}

                    <NumberField
                      id="minedge2"
                      error={erreurs["minedge2"]}
                      label="Distance au bord minimale"
                      value={isFinite(minEdge2) ? minEdge2 : ""}
                      onChange={setMinEdge2}
                    />
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
                    <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/40 p-1">
                      {[false, true].map((m) => (
                        <button
                          key={String(m)}
                          type="button"
                          onClick={() => setMulti3(m)}
                          aria-pressed={multi3 === m}
                          className={
                            "rounded px-2 py-1.5 text-xs font-medium transition-colors " +
                            (multi3 === m
                              ? "bg-background text-[var(--color-trame)] shadow-sm"
                              : "text-muted-foreground hover:text-foreground")
                          }
                        >
                          {m ? "Plusieurs pièces" : "Une pièce"}
                        </button>
                      ))}
                    </div>

                    {multi3 ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="pieces3" className="text-xs font-medium text-muted-foreground">
                          Repère / Longueur — une pièce par ligne
                        </Label>
                        <Textarea
                          id="pieces3"
                          value={pieces3}
                          onChange={(e) => setPieces3(e.target.value)}
                          rows={6}
                          spellCheck={false}
                          placeholder={"A1\t3000\nA2\t2450"}
                          className="font-mono text-sm tabular-nums"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Collez deux colonnes depuis Excel ou tapez « A1 3000 ».{" "}
                          {parsed3.pieces.length} pièce{parsed3.pieces.length > 1 ? "s" : ""} lue
                          {parsed3.pieces.length > 1 ? "s" : ""}
                          {parsed3.ignored > 0 &&
                            ` · ${parsed3.ignored} ligne${parsed3.ignored > 1 ? "s" : ""} ignorée${parsed3.ignored > 1 ? "s" : ""}`}
                        </p>
                      </div>
                    ) : (
                      <NumberField error={erreurs["L3"]} id="L3" label="Longueur totale (L)" value={isFinite(L3) ? L3 : ""} onChange={setL3} />
                    )}

                    {!autoRives3 && (
                      <div className="grid grid-cols-2 gap-3">
                        <NumberField error={erreurs["ds3"]} id="ds3" label="Distance au bord début" value={isFinite(Ds3) ? Ds3 : ""} onChange={setDs3} />
                        <NumberField
                          id="de3"
                          error={erreurs["de3"]}
                          label="Distance au bord fin"
                          value={sameEnd3 ? (isFinite(Ds3) ? Ds3 : "") : isFinite(De3) ? De3 : ""}
                          onChange={setDe3}
                          disabled={sameEnd3}
                        />
                      </div>
                    )}

                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
                      <span className="text-xs font-medium text-foreground">Distances au bord identiques</span>
                      <Switch checked={sameEnd3} onCheckedChange={setSameEnd3} />
                    </label>

                    <NumberField
                      id="emax"
                      error={erreurs["emax"]}
                      label="Entraxe maximum"
                      value={isFinite(Emax) ? Emax : ""}
                      onChange={setEmax}
                    />

                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-[var(--color-trame)]/40 bg-[var(--color-trame)]/5 px-3 py-2">
                      <span className="text-xs font-medium text-foreground">
                        Calculer les distances au bord automatiquement
                      </span>
                      <Switch checked={autoRives3} onCheckedChange={setAutoRives3} />
                    </label>

                    {autoRives3 && (
                      <NumberField
                        id="rivemin3"
                        error={erreurs["rivemin3"]}
                        label="Distance au bord minimale"
                        value={isFinite(riveMin3) ? riveMin3 : ""}
                        onChange={setRiveMin3}
                      />
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">Options</h2>
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
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
              key={mode + (autoRives3 ? "-auto" : "") + (isMulti ? "-multi" : "")}
              title={
                mode === "intervals"
                  ? "Répartitions possibles"
                  : mode === "pitch"
                    ? "Répartition"
                    : isMulti
                      ? "Répartition par pièce"
                      : autoRives3
                        ? "Distances au bord optimisées"
                        : "Répartitions sous l'entraxe maximum"
              }
              options={
                mode === "intervals"
                  ? fromIntervalRows(intervalsData.rows, Ds, effectiveDe)
                  : mode === "pitch"
                    ? fromPitchRows(pitchRows)
                    : isMulti
                      ? multiData.options
                      : autoRives3
                      ? fromPitchRows(autoRiveData.rows)
                      : fromIntervalRows(maxPitchData.rows, Ds3, effectiveDe3)
              }
              integers={mode === "pitch" ? false : integers}
              totalLength={mode === "intervals" ? L : mode === "pitch" ? L2 : L3}
              copy={copy}
              copiedIdx={copiedIdx}
              recommendFirst={mode === "maxpitch" && !isMulti}
              defaultIndex={mode === "intervals" ? indexPlusRond(fromIntervalRows(intervalsData.rows, Ds, effectiveDe)) : 0}
              notice={
                isMulti && multiData.failed.length > 0
                  ? `Sans solution avec ces paramètres : ${multiData.failed
                      .map((f) => `${f.mark} (${fmt(f.length)} mm)`)
                      .join(", ")}`
                  : undefined
              }
              empty={
                isMulti && !parsed3.pieces.length ? (
                  <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                    Ajoutez des pièces (repère et longueur) pour voir leur répartition.
                  </div>
                ) : 
                mode !== "pitch" && integers ? (
                  <EmptyIntegerNotice
                    message={
                      mode === "intervals"
                        ? "Aucune répartition en millimètres entiers jusqu'à ce nombre d'intervalles."
                        : autoRives3
                          ? "Aucune répartition en millimètres entiers trouvée avec cette distance au bord minimale et cet entraxe maximum."
                          : "Aucune répartition en millimètres entiers trouvée sous cet entraxe maximum."
                    }
                    onShowDecimals={() => setIntegers(false)}
                  />
                ) : (
                  <div role="alert" className="rounded-xl border border-dashed border-destructive/40 bg-card p-10 text-center text-sm text-muted-foreground">
                    {premiereErreur
                      ? <>Corrigez le champ en rouge : <b className="font-semibold text-destructive">{premiereErreur}</b>.</>
                      : "Aucune répartition possible avec ces valeurs."}
                  </div>
                )
              }
            />
          </section>
        </div>

        <p className="mt-10 border-t border-border pt-4 text-center text-[11px] text-muted-foreground">
          <span className="rounded-md bg-background px-2 py-0.5">Cotes en millimètres · cumulées depuis le bord de départ</span>
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

/** Logo « Trame » (style Epure) : une piece et ses percages, celui du milieu en vert. */
function TrameMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="1" y="7" width="20" height="8" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-foreground" />
      <circle cx="5" cy="11" r="1.6" fill="currentColor" className="text-foreground" />
      <circle cx="11" cy="11" r="1.6" fill="var(--color-trame)" />
      <circle cx="17" cy="11" r="1.6" fill="currentColor" className="text-foreground" />
    </svg>
  );
}
