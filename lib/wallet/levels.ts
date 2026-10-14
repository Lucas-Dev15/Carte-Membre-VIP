/**
 * Paliers de niveau, calculés sur les volts CUMULÉS (ils ne baissent jamais).
 *
 * Repères (barème « Gagner des volts ») : une soirée avec présence, questionnaire
 * et replay rapporte environ 135 volts.
 *   1 Curieux       0     inscription
 *   2 Initié        200   ≈ 2 soirées
 *   3 Explorateur   450   ≈ 4 soirées
 *   4 Praticien     800   ≈ 6 soirées (seuil de la maquette : 760 → « encore 40 »)
 *   5 Expert        1300  ≈ 10 soirées
 */
export interface Level {
  rank: number;
  name: string;
  minVolts: number;
}

export const LEVELS: readonly Level[] = [
  { rank: 1, name: "Curieux", minVolts: 0 },
  { rank: 2, name: "Initié", minVolts: 200 },
  { rank: 3, name: "Explorateur", minVolts: 450 },
  { rank: 4, name: "Praticien", minVolts: 800 },
  { rank: 5, name: "Expert", minVolts: 1300 },
];

export function levelFor(volts: number): Level {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (volts >= level.minVolts) current = level;
  }
  return current;
}

export function nextLevel(volts: number): Level | null {
  return LEVELS.find((l) => l.minVolts > volts) ?? null;
}

/** « 3 · Explorateur » */
export function levelLabel(volts: number): string {
  const l = levelFor(volts);
  return `${l.rank} · ${l.name}`;
}

/** « Encore 40 volts pour Praticien » ou « Niveau maximum atteint » */
export function progressLabel(volts: number): string {
  const next = nextLevel(volts);
  if (!next) return "Niveau maximum atteint";
  return `Encore ${next.minVolts - volts} volts pour ${next.name}`;
}

/** Progression 0..1 dans le palier courant (barre de la carte web uniquement). */
export function progressRatio(volts: number): number {
  const cur = levelFor(volts);
  const next = nextLevel(volts);
  if (!next) return 1;
  return (volts - cur.minVolts) / (next.minVolts - cur.minVolts);
}
