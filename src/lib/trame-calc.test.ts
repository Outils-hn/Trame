import { describe, expect, it } from "vitest";
import { buildAutoRiveRows, champsInvalides, indexPlusRond, buildIntervalRows, buildMaxPitchRows, buildMultiPieceOptions, buildPitchRows, cadPitch, chainText, fromIntervalRows, fromPitchRows, parsePieces, piecesTable } from "./trame-calc";

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

describe("affichage unifie", () => {
  it("repere les repartitions en mm ronds", () => {
    const { rows } = buildIntervalRows(3094, 50, 50, 5, false);
    const opts = fromIntervalRows(rows, 50, 50);
    expect(opts.map((o) => o.round)).toEqual([true, true, true, false, false]);
    expect(opts[2]!.dEnd).toBe(50);
  });
  it("reprend les distances au bord calculees en entraxe fixe", () => {
    const [o] = fromPitchRows(buildPitchRows(3094, 100, true, 0, false));
    expect([o!.dStart, o!.pitch, o!.dEnd, o!.holes]).toEqual([47, 100, 47, 31]);
  });
});

describe("distance au bord minimale (entraxe fixe)", () => {
  it("ecarte le percage au ras du bord : 3000 / 100 donne 29 intervalles a 50 / 50", () => {
    const rows = buildPitchRows(3000, 100, true, 0, false, 30);
    expect([rows[0]!.N, rows[0]!.rDebut, rows[0]!.rFin]).toEqual([29, 50, 50]);
    for (const r of rows) expect(Math.min(r.rDebut, r.rFin)).toBeGreaterThanOrEqual(30);
  });
  it("debut impose : le reste en fin respecte aussi le minimum", () => {
    const [r] = buildPitchRows(3000, 100, false, 50, false, 30);
    expect(r!.rFin).toBeGreaterThanOrEqual(30);
    expect(r!.rDebut + r!.N * 100 + r!.rFin).toBe(3000);
  });
  it("sans minimum, l'ancien comportement est conserve (3094 : 47 / 47)", () => {
    const [r] = buildPitchRows(3094, 100, true, 0, false);
    expect([r!.rDebut, r!.rFin]).toEqual([47, 47]);
  });
});

describe("aide AutoCAD", () => {
  it("entraxe avec point decimal, sans separateur", () => {
    expect(cadPitch(299.4)).toBe("@299.4<0");
    expect(cadPitch(1250)).toBe("@1250<0");
    expect(cadPitch(2994 / 7)).toBe("@427.7143<0");
  });
});

describe("plusieurs pieces", () => {
  it("lit un collage Excel avec en-tete, virgules et lignes vides", () => {
    const { pieces, ignored } = parsePieces("Repère\tLongueur\nA1\t3000\n\nA2\t2 450,5\n1830\nPoteau 3 1200 mm\nA1 2450");
    expect(ignored).toBe(1);
    expect(pieces).toEqual([
      { mark: "A1", length: 3000 },
      { mark: "A2", length: 2450.5 },
      { mark: "P3", length: 1830 },
      { mark: "Poteau 3", length: 1200 },
      { mark: "A1", length: 2450 },
    ]);
  });
  it("chaque piece garde le moins de percages sous l'entraxe maximum", () => {
    const pieces = [{ mark: "A", length: 3094 }, { mark: "B", length: 1000 }, { mark: "C", length: 80 }];
    const { options, failed } = buildMultiPieceOptions(pieces, {
      auto: false, Ds: 50, De: 50, Emax: 300, minEdge: 30, symmetric: true, integers: false,
    });
    expect(failed.map((f) => f.mark)).toEqual(["C"]);
    expect(options.map((o) => [o.mark, o.length, o.N])).toEqual([["A", 3094, 10], ["B", 1000, 3]]);
    expect(close(options[0]!.pitch, 299.4)).toBe(true);
  });
  it("mode distances au bord automatiques : bilan exact par piece", () => {
    const pieces = [{ mark: "A", length: 3000 }, { mark: "B", length: 2450 }];
    for (const integers of [false, true]) {
      const { options } = buildMultiPieceOptions(pieces, {
        auto: true, Ds: 0, De: 0, Emax: 300, minEdge: 30, symmetric: true, integers,
      });
      expect(options).toHaveLength(2);
      for (const o of options) {
        expect(o.pitch).toBeLessThanOrEqual(300);
        expect(close(o.dStart + o.N * o.pitch + o.dEnd, o.length!)).toBe(true);
      }
    }
  });
  it("tableau pour Excel : tabulations et virgule decimale", () => {
    const { options } = buildMultiPieceOptions([{ mark: "A", length: 3094 }], {
      auto: false, Ds: 50, De: 50, Emax: 300, minEdge: 0, symmetric: true, integers: false,
    });
    expect(piecesTable(options).split("\n")[1]).toBe("A\t3094\t11\t299,4\t50\t50");
  });
});

describe("cote de chaine", () => {
  it("texte de remplacement pour la cote AutoCAD", () => {
    expect(chainText(10, 290)).toBe("10 x 290 = <>");
    expect(chainText(10, 299.4)).toBe("10 x 299,4 = <>");
    expect(chainText(3, 2900 / 3)).toBe("3 x 966,7 = <>");
    expect(chainText(1, 2900)).toBe("1 x 2900 = <>");
  });
});

describe("limites de calcul", () => {
  it("entraxe maximum : plus de plafond a 40 intervalles (6000 / 120)", () => {
    const { rows, Nmin } = buildMaxPitchRows(6000, 30, 30, 120, false);
    expect(Nmin).toBe(50);
    expect(rows[0]!.N).toBe(50);
    for (const r of rows) expect(r.pitch).toBeLessThanOrEqual(120);
  });
  it("entraxe maximum en mm entiers au-dela de 40 intervalles", () => {
    const { rows } = buildMaxPitchRows(12000, 0, 0, 250, true);
    expect(rows[0]!.N).toBe(48);
    expect(rows[0]!.pitch).toBe(250);
  });
  it("plusieurs pieces : une piece longue a petit entraxe trouve sa solution", () => {
    const { options, failed } = buildMultiPieceOptions([{ mark: "L", length: 6000 }], {
      auto: false, Ds: 30, De: 30, Emax: 120, minEdge: 0, symmetric: true, integers: false,
    });
    expect(failed).toHaveLength(0);
    expect(options[0]!.N).toBe(50);
  });
  it("nombre d'intervalles : plus de limite cachee a 20", () => {
    expect(buildIntervalRows(6000, 50, 50, 40, false).rows).toHaveLength(40);
  });
  it("entraxe fixe, debut impose en mm entiers : la somme reste exacte", () => {
    const [r] = buildPitchRows(1000, 300, false, 12.5, true);
    expect(r!.rDebut + r!.N * r!.entraxe + r!.rFin).toBe(1000);
    expect(r!.positions[0]).toBe(r!.rDebut);
  });
});

describe("collage : separateurs suisses", () => {
  it("apostrophe droite et typographique", () => {
    const { pieces } = parsePieces("A\t3'094\nB\t3’094\nC\t3 094");
    expect(pieces.map((p) => p.length)).toEqual([3094, 3094, 3094]);
  });
});

describe("quick wins : saisies a corriger", () => {
  const base = { L: 3000, Ds: 50, De: 50, maxIntervals: 5, L2: 3000, E: 100, symmetric: true, Dstart: 50, minEdge2: 30, L3: 3000, Ds3: 50, De3: 50, Emax: 300, autoRives3: false, riveMin3: 30, multi3: false };
  it("valeurs normales : rien a corriger", () => {
    for (const m of ["intervals", "pitch", "maxpitch"] as const) expect(champsInvalides(m, base)).toEqual({});
  });
  it("le champ fautif est designe avec sa raison", () => {
    expect(champsInvalides("intervals", { ...base, L: -3000 }).L).toMatch(/supérieure à 0/);
    expect(champsInvalides("intervals", { ...base, L: 500, Ds: 400, De: 400 }).ds).toMatch(/dépassent/);
    expect(champsInvalides("intervals", { ...base, maxIntervals: 2.5 }).pm).toMatch(/entier/);
    expect(champsInvalides("pitch", { ...base, E: 0 }).E).toMatch(/supérieure à 0/);
    expect(champsInvalides("maxpitch", { ...base, Emax: -300 }).emax).toMatch(/supérieure à 0/);
    expect(champsInvalides("intervals", { ...base, L: NaN }).L).toBe("Champ vide");
  });
  it("collage : une longueur vide n'est plus lue comme une piece de 2 mm", () => {
    const { pieces, ignored } = parsePieces("A1\t3000\nB2\t\nB3\t-50");
    expect(pieces).toEqual([{ mark: "A1", length: 3000 }]);
    expect(ignored).toBe(2);
  });
});

describe("repartition selectionnee d'office : l'entraxe le plus rond", () => {
  it("3000 mm, bords 50 : 580 mm (5 intervalles) plutot que 2 900 (1 intervalle)", () => {
    const opts = [2900, 1450, 966.667, 725, 580].map((pitch, i) => ({ pitch, N: i + 1 }));
    expect(indexPlusRond(opts)).toBe(4);
  });
  it("un entraxe multiple de 10 l'emporte sur un multiple de 5", () => {
    expect(indexPlusRond([{ pitch: 600, N: 4 }, { pitch: 485, N: 5 }])).toBe(0);
  });
});

describe("garde-fous (audit)", () => {
  it("entraxe fixe : trop de percages = pas de resultat", () => {
    expect(buildPitchRows(3000, 0.01, true, 0, false)).toEqual([]);
    expect(buildPitchRows(3000, 100, true, 0, false).length).toBeGreaterThan(0);
  });
  it("entraxe maxi minuscule : pas de resultat", () => {
    expect(buildMaxPitchRows(3000, 50, 50, 0.001, false).rows).toEqual([]);
  });
  it("champsInvalides : entraxe trop petit et longueur trop grande", () => {
    const base = { L: 3000, Ds: 50, De: 50, maxIntervals: 5, L2: 3000, E: 0.01, symmetric: true, Dstart: 0, minEdge2: 0, L3: 3000, Ds3: 50, De3: 50, Emax: 600, autoRives3: false, riveMin3: 0, multi3: false };
    expect(champsInvalides("pitch", base).E).toMatch(/Entraxe trop petit/);
    expect(champsInvalides("intervals", { ...base, L: 1e12 }).L).toMatch(/Trop grande/);
  });
  it("parsePieces : negatif ignore, numeros de ligne donnes", () => {
    const r = parsePieces("A1 3000\nA3 -5\nA2 abc\nA4\t2450");
    expect(r.pieces.map((p) => p.mark)).toEqual(["A1", "A4"]);
    expect(r.ignored).toBe(2);
    expect(r.ignoredLines).toEqual([2, 3]);
  });
});
