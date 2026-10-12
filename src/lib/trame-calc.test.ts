import { describe, expect, it } from "vitest";
import { buildAutoRiveRows, buildIntervalRows, buildMaxPitchRows, buildPitchRows } from "./trame-calc";

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe("nombre d'intervalles", () => {
  it("repartit la longueur utile en parts egales", () => {
    const { rows, Lu } = buildIntervalRows(3094, 50, 50, 5, false);
    expect(Lu).toBe(2994);
    expect(rows).toHaveLength(5);
    expect(rows[1]!.positions).toEqual([50, 1547, 3044]);
  });
  it("en mm entiers, ne garde que les entraxes ronds", () => {
    const { rows } = buildIntervalRows(3094, 50, 50, 10, true);
    for (const r of rows) expect(Number.isInteger(r.pitch)).toBe(true);
  });
});

describe("entraxe fixe", () => {
  it("distances au bord identiques : 47 + 30 x 100 + 47 = 3094", () => {
    const [r] = buildPitchRows(3094, 100, true, 0, false);
    expect(r!.N).toBe(30);
    expect(r!.rDebut).toBe(47);
    expect(r!.rFin).toBe(47);
  });
  it("en mm entiers, un reste impair donne 47 / 48 et la somme reste exacte", () => {
    const [r] = buildPitchRows(3095, 100, true, 0, true);
    expect([r!.rDebut, r!.rFin]).toEqual([47, 48]);
    expect(r!.rDebut + r!.N * r!.entraxe + r!.rFin).toBe(3095);
    expect(r!.positions.at(-1)).toBe(3095 - 48);
  });
  it("distance au bord debut imposee : le reste va en fin", () => {
    const [r] = buildPitchRows(3094, 100, false, 50, false);
    expect(r!.rDebut).toBe(50);
    expect(close(r!.rDebut + r!.N * 100 + r!.rFin, 3094)).toBe(true);
  });
});

describe("entraxe maximum", () => {
  it("premiere proposition = minimum d'intervalles sous le plafond", () => {
    const { rows, Nmin } = buildMaxPitchRows(3094, 50, 50, 300, false);
    expect(Nmin).toBe(10);
    expect(rows[0]!.N).toBe(10);
    expect(close(rows[0]!.pitch, 299.4)).toBe(true);
    for (const r of rows) expect(r.pitch).toBeLessThanOrEqual(300);
  });
  it("distances au bord automatiques : bilan exact et plafonds respectes", () => {
    for (const symmetric of [true, false])
      for (const integers of [false, true]) {
        const { rows } = buildAutoRiveRows(3094, 300, 30, symmetric, integers);
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) {
          expect(r.entraxe).toBeLessThanOrEqual(300 + 1e-9);
          expect(r.rDebut).toBeGreaterThanOrEqual(30 - 1e-9);
          expect(r.rFin).toBeGreaterThanOrEqual(30 - 1e-9);
          expect(close(r.rDebut + r.N * r.entraxe + r.rFin, 3094)).toBe(true);
          if (integers) expect([r.rDebut, r.entraxe, r.rFin].every(Number.isInteger)).toBe(true);
        }
      }
  });
});
