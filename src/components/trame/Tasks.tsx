import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ClipboardList, ListChecks, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmt, type DrillOption } from "@/lib/trame-calc";
import {
  fmtD, lineTotal, nextTaskName, parseDiameters, readTasks, taskTable, taskTotals, uid, writeTasks,
  type Task, type TaskLine, type TaskStore,
} from "@/lib/trame-tasks";

// ---------- Etat partage (stocke dans le navigateur uniquement) ----------

interface Ctx {
  store: TaskStore;
  active: Task | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  setActive: (id: string) => void;
  createTask: () => string;
  renameTask: (id: string, name: string) => void;
  deleteTask: (id: string) => void;
  addLine: (taskId: string | null, line: Omit<TaskLine, "id">) => string;
  updateLine: (taskId: string, lineId: string, patch: Partial<TaskLine>) => void;
  removeLine: (taskId: string, lineId: string) => void;
  /** Ouvre la fenetre "Ajouter a la tache" pour la repartition choisie. */
  startAdd: (opt: DrillOption, length: number) => void;
}

const TasksCtx = createContext<Ctx | null>(null);

export function useTasks() {
  const c = useContext(TasksCtx);
  if (!c) throw new Error("useTasks hors TasksProvider");
  return c;
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<TaskStore>({ tasks: [], activeId: null });
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<{ opt: DrillOption; length: number } | null>(null);

  useEffect(() => setStore(readTasks()), []);

  // Toute modification passe par ici : etat + sauvegarde navigateur.
  const update = useCallback((fn: (s: TaskStore) => TaskStore) => {
    setStore((prev) => {
      const next = fn(prev);
      writeTasks(next);
      return next;
    });
  }, []);

  const createTask = useCallback(() => {
    const id = uid();
    update((s) => ({ tasks: [...s.tasks, { id, name: nextTaskName(s.tasks), createdAt: Date.now(), lines: [] }], activeId: id }));
    return id;
  }, [update]);

  const ctx = useMemo<Ctx>(() => {
    const mapTask = (id: string, fn: (t: Task) => Task) => (s: TaskStore) => ({
      ...s, tasks: s.tasks.map((t) => (t.id === id ? fn(t) : t)),
    });
    return {
      store,
      active: store.tasks.find((t) => t.id === store.activeId) ?? store.tasks[store.tasks.length - 1] ?? null,
      open,
      setOpen,
      setActive: (id) => update((s) => ({ ...s, activeId: id })),
      createTask,
      renameTask: (id, name) => update(mapTask(id, (t) => ({ ...t, name }))),
      deleteTask: (id) =>
        update((s) => {
          const tasks = s.tasks.filter((t) => t.id !== id);
          return { tasks, activeId: s.activeId === id ? (tasks[tasks.length - 1]?.id ?? null) : s.activeId };
        }),
      addLine: (taskId, line) => {
        const lineId = uid();
        update((s) => {
          let tasks = s.tasks;
          let id = taskId;
          if (!id || !tasks.some((t) => t.id === id)) {
            id = uid();
            tasks = [...tasks, { id, name: nextTaskName(tasks), createdAt: Date.now(), lines: [] }];
          }
          const target = id;
          return {
            tasks: tasks.map((t) => (t.id === target ? { ...t, lines: [...t.lines, { ...line, id: lineId }] } : t)),
            activeId: target,
          };
        });
        return lineId;
      },
      updateLine: (taskId, lineId, patch) =>
        update(mapTask(taskId, (t) => ({ ...t, lines: t.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) }))),
      removeLine: (taskId, lineId) => update(mapTask(taskId, (t) => ({ ...t, lines: t.lines.filter((l) => l.id !== lineId) }))),
      startAdd: (opt, length) => setPending({ opt, length }),
    };
  }, [store, open, update, createTask]);

  return (
    <TasksCtx.Provider value={ctx}>
      {children}
      <AddToTaskDialog pending={pending} onClose={() => setPending(null)} />
    </TasksCtx.Provider>
  );
}

// ---------- Bouton d'en-tete ----------

export function TasksButton() {
  const { setOpen, active } = useTasks();
  const total = active ? taskTotals(active).fixings : 0;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
      aria-label="Ouvrir les tâches"
    >
      <ListChecks className="size-4" />
      Tâches
      {active && active.lines.length > 0 && (
        <span className="rounded bg-[var(--color-trame)] px-1.5 py-0.5 text-[10px] font-bold text-white dark:text-zinc-950 tabular-nums">
          {total}
        </span>
      )}
    </button>
  );
}

// ---------- Fenetre "Ajouter a la tache" ----------

const LAST_D = "trame:tasks:lastDiameters";
const NEW = "__new__";

function AddToTaskDialog({ pending, onClose }: { pending: { opt: DrillOption; length: number } | null; onClose: () => void }) {
  const { store, active, addLine } = useTasks();
  const [taskId, setTaskId] = useState<string>(NEW);
  const [mark, setMark] = useState("");
  const [qty, setQty] = useState(1);
  const [rows, setRows] = useState(1);
  const [diam, setDiam] = useState("");

  // A chaque ouverture : tache active, repere de la piece, derniers diametres utilises.
  useEffect(() => {
    if (!pending) return;
    setTaskId(active?.id ?? NEW);
    setMark(pending.opt.mark ?? "");
    setQty(1);
    setRows(1);
    try {
      setDiam(window.localStorage.getItem(LAST_D) ?? "");
    } catch {
      setDiam("");
    }
  }, [pending, active?.id]);

  if (!pending) return null;
  const { opt, length } = pending;
  const ok = qty >= 1 && rows >= 1 && Number.isInteger(qty) && Number.isInteger(rows);
  const total = ok ? qty * rows * opt.holes : 0;

  const submit = () => {
    if (!ok) return;
    const diameters = parseDiameters(diam);
    addLine(taskId === NEW ? null : taskId, {
      mark: mark.trim() || "—", qty, rows, holes: opt.holes, diameters,
      length, pitch: opt.pitch, dStart: opt.dStart, dEnd: opt.dEnd,
    });
    try {
      window.localStorage.setItem(LAST_D, diam);
    } catch {
      /* ignore */
    }
    const name = taskId === NEW ? nextTaskName(store.tasks) : store.tasks.find((t) => t.id === taskId)?.name;
    toast.success(`${mark.trim() || "Pièce"} ajoutée à ${name} · ${total} fixations`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter à la tâche</DialogTitle>
          <DialogDescription className="tabular-nums">
            {fmt(length)} mm · {opt.holes} perçages · entraxe {fmt(opt.pitch)} mm
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="t-task" className="text-xs text-muted-foreground">Tâche</Label>
            <select
              id="t-task"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {store.tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              <option value={NEW}>+ Nouvelle tâche ({nextTaskName(store.tasks)})</option>
            </select>
          </div>

          <div className="grid grid-cols-[1fr_80px_80px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-mark" className="text-xs text-muted-foreground">Repère</Label>
              <Input id="t-mark" value={mark} onChange={(e) => setMark(e.target.value)} placeholder="A1" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-qty" className="text-xs text-muted-foreground">Qté pièces</Label>
              <Input id="t-qty" type="number" min={1} step={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="text-right tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-rows" className="text-xs text-muted-foreground">Rangées</Label>
              <Input id="t-rows" type="number" min={1} step={1} value={rows} onChange={(e) => setRows(Number(e.target.value))} className="text-right tabular-nums" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-diam" className="text-xs text-muted-foreground">Diamètre(s) du perçage (mm)</Label>
            <Input id="t-diam" value={diam} onChange={(e) => setDiam(e.target.value)} placeholder="6,5   ou   6,5 + 11 pour un trou étagé" />
            <div className="flex flex-wrap gap-1.5">
              {parseDiameters(diam).map((d) => (
                <span key={d} className="rounded border border-border px-1.5 py-0.5 text-xs tabular-nums">{fmtD(d)}</span>
              ))}
            </div>
          </div>

          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm tabular-nums">
            {opt.holes} perçages × {rows} rangée{rows > 1 ? "s" : ""} × {qty} pièce{qty > 1 ? "s" : ""} ={" "}
            <b className="text-[var(--color-trame)]">{total} fixations</b>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={!ok} className="gap-1.5 bg-[var(--color-trame)] text-white hover:bg-[var(--color-trame)]/90 dark:text-zinc-950">
              <Plus className="size-4" /> Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Volet des taches ----------

const cell = "h-8 w-16 rounded border border-input bg-background px-1.5 text-right text-sm tabular-nums";

export function TasksPanel() {
  const { store, active, open, setOpen, setActive, createTask, renameTask, deleteTask, updateLine, removeLine } = useTasks();
  const totals = active ? taskTotals(active) : null;

  const copyTable = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(taskTable(active));
      toast.success("Tâche copiée, collez-la dans Excel");
    } catch {
      toast.error("Impossible de copier");
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="text-base">Tâches</SheetTitle>
          <SheetDescription className="text-xs">
            Ajoutez des pièces depuis le détail d'une répartition pour compter les fixations à commander. Enregistré dans ce navigateur uniquement.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-wrap items-center gap-2 px-4">
          {store.tasks.length > 0 && (
            <select
              value={active?.id ?? ""}
              onChange={(e) => setActive(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Tâche affichée"
            >
              {store.tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={createTask} className="gap-1.5">
            <Plus className="size-3.5" /> Nouvelle tâche
          </Button>
        </div>

        {!active ? (
          <p className="mx-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
            Aucune tâche. Cliquez « Ajouter à la tâche » sous une répartition, ou créez-en une.
          </p>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            <div className="flex items-center gap-2">
              <Input
                value={active.name}
                onChange={(e) => renameTask(active.id, e.target.value)}
                className="h-9 max-w-xs font-semibold"
                aria-label="Nom de la tâche"
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => window.confirm(`Supprimer ${active.name} ?`) && deleteTask(active.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>

            {active.lines.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                Tâche vide pour l'instant.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left">Repère</th>
                      <th className="px-2 py-2 text-right">Qté</th>
                      <th className="px-2 py-2 text-right">Rangées</th>
                      <th className="px-2 py-2 text-right" title="Perçages par rangée">Perç.</th>
                      <th className="px-2 py-2 text-left">Diamètres</th>
                      <th className="px-2 py-2 text-right">Fixations</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {active.lines.map((l) => (
                      <tr key={l.id} className="border-b border-border/60 last:border-0">
                        <td className="px-2 py-1.5">
                          <input
                            value={l.mark}
                            onChange={(e) => updateLine(active.id, l.id, { mark: e.target.value })}
                            className="h-8 w-20 rounded border border-input bg-background px-1.5 text-sm font-medium"
                          />
                          <div className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                            {fmt(l.length)} mm · {fmt(l.pitch)}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <input type="number" min={1} value={l.qty} className={cell}
                            onChange={(e) => updateLine(active.id, l.id, { qty: Math.max(1, Math.round(Number(e.target.value) || 1)) })} />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <input type="number" min={1} value={l.rows} className={cell}
                            onChange={(e) => updateLine(active.id, l.id, { rows: Math.max(1, Math.round(Number(e.target.value) || 1)) })} />
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{l.holes}</td>
                        <td className="px-2 py-1.5">
                          <DiameterInput value={l.diameters} onChange={(d) => updateLine(active.id, l.id, { diameters: d })} />
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-[var(--color-trame)]">{lineTotal(l)}</td>
                        <td className="px-1 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => removeLine(active.id, l.id)}
                            className="rounded p-1 text-muted-foreground hover:text-destructive"
                            aria-label={`Retirer ${l.mark}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totals && active.lines.length > 0 && (
              <section className="rounded-lg border border-[var(--color-trame)]/40 bg-[var(--color-trame)]/5 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Total à commander</span>
                  <span className="text-sm text-muted-foreground tabular-nums">{totals.pieces} pièce{totals.pieces > 1 ? "s" : ""}</span>
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-trame)]">{totals.fixings} fixations</div>
                {(totals.byDiameter.length > 0 || totals.noDiameter > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs tabular-nums">
                    {totals.byDiameter.map(({ d, count }) => (
                      <span key={d} className="rounded border border-border bg-background px-2 py-1">
                        Perçages {fmtD(d)} : <b>{count}</b>
                      </span>
                    ))}
                    {totals.noDiameter > 0 && (
                      <span className="rounded border border-dashed border-border px-2 py-1 text-muted-foreground">
                        Sans diamètre : {totals.noDiameter}
                      </span>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {active && active.lines.length > 0 && (
          <div className="border-t border-border px-4 py-3">
            <Button variant="outline" size="sm" onClick={copyTable} className="w-full gap-1.5">
              <ClipboardList className="size-3.5" /> Copier la tâche pour Excel
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Champ diametres : texte libre, relu a la sortie du champ ("6,5 + 11"). */
function DiameterInput({ value, onChange }: { value: number[]; onChange: (d: number[]) => void }) {
  const shown = value.map((d) => String(d).replace(".", ",")).join(" + ");
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(parseDiameters(text))}
      placeholder="Ø"
      className="h-8 w-24 rounded border border-input bg-background px-1.5 text-sm tabular-nums"
    />
  );
}
