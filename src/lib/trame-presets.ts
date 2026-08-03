/** Préréglages matériaux / profilés façade. */
export interface MaterialPreset {
  id: string;
  name: string;
  hint: string;
  /** Rive (distance de bord) en mm */
  margin: number;
  /** Entraxe maximum courant en mm */
  pitchMax: number;
  /** Ø vis (point fixe) en mm */
  screw?: number;
  /** Ø perçage (point glissant) en mm */
  hole?: number;
}

export const MATERIAL_PRESETS: MaterialPreset[] = [
  {
    id: "cassette-alu-2",
    name: "Cassette Alu 2 mm",
    hint: "Rives 40 · Pas max 500 · Ø 6,5",
    margin: 40,
    pitchMax: 500,
    hole: 6.5,
  },
  {
    id: "hpl-composite",
    name: "Panneau HPL / Composite (DTU 41.2)",
    hint: "Rives 50 · Pas max 600 · Ø 5,5 / 8,5",
    margin: 50,
    pitchMax: 600,
    screw: 5.5,
    hole: 8.5,
  },
  {
    id: "ossature-lisse",
    name: "Ossature Lisse Verticale",
    hint: "Rives 50 · Pas max 300",
    margin: 50,
    pitchMax: 300,
  },
  {
    id: "bardage-nervure",
    name: "Bardage Tôle Nervurée",
    hint: "Rives 30 · Pas max 400",
    margin: 30,
    pitchMax: 400,
  },
];

export function getPreset(id: string) {
  return MATERIAL_PRESETS.find((p) => p.id === id);
}
