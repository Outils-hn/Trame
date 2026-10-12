import { describe, expect, it } from "vitest";
import { lineTotal, nextTaskName, parseDiameters, taskTable, taskTotals, type Task, type TaskLine } from "./trame-tasks";

const line = (p: Partial<TaskLine>): TaskLine => ({
  id: "x", mark: "A", qty: 1, rows: 1, holes: 11, diameters: [], length: 3000, pitch: 290, dStart: 50, dEnd: 50, ...p,
});

describe("taches", () => {
  it("numerote les taches a la suite", () => {
    expect(nextTaskName([])).toBe("Tâche 0001");
    const t = (name: string): Task => ({ id: name, name, createdAt: 0, lines: [] });
    expect(nextTaskName([t("Tâche 0001"), t("Tâche 0007"), t("Chantier")])).toBe("Tâche 0008");
  });
  it("lit un ou plusieurs diametres", () => {
    expect(parseDiameters("6,5 + 11")).toEqual([6.5, 11]);
    expect(parseDiameters("Ø6.5 / Ø11 / 6,5")).toEqual([6.5, 11]);
    expect(parseDiameters("")).toEqual([]);
  });
  it("fixations = pieces x rangees x percages, totaux par diametre", () => {
    const task: Task = {
      id: "t", name: "Tâche 0001", createdAt: 0,
      lines: [
        line({ mark: "A1", qty: 4, rows: 1, holes: 11, diameters: [6.5] }),
        line({ mark: "A2", qty: 12, rows: 2, holes: 9, diameters: [6.5, 11] }),
        line({ mark: "A3", qty: 2, rows: 1, holes: 5 }),
      ],
    };
    expect(lineTotal(task.lines[1]!)).toBe(216);
    const t = taskTotals(task);
    expect([t.pieces, t.fixings, t.noDiameter]).toEqual([18, 44 + 216 + 10, 10]);
    expect(t.byDiameter).toEqual([{ d: 6.5, count: 260 }, { d: 11, count: 216 }]);
    const rows = taskTable(task).split("\n");
    expect(rows[2]).toBe("A1\t4\t3000\t1\t11\t290\tØ6,5\t44");
    expect(rows[3]).toBe("A2\t12\t3000\t2\t9\t290\tØ6,5 + Ø11\t216");
    expect(rows[5]).toBe("Total\t18\t\t\t\t\t\t270");
  });
});
