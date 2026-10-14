/**
 * Paliers de niveau, calculés sur les volts CUMULÉS (ils ne baissent jamais).
 *
 * ⚠️ À CONFIRMER : la spécification ne donne que « 3 · Explorateur » et
 * « 4 · Praticien » à 800 volts (760 volts → « encore 40 pour Praticien »).
 * Les autres noms et seuils ci-dessous sont des valeurs provisoires.
 */
export interface Level {
  rank: number;
  name: string;
  minVolts: number;
}

export const LEVELS: readonly Level[] = [
  { rank: 1, name: "Curieux", minVolts: 0 }, // provisoire
  { rank: 2, name: "Initié", minVolts: 300 }, // provisoire
  { rank: 3, name: "Explorateur", minVolts: 500 }, // seuil provisoire
  { rank: 4, name: "Praticien", minVolts: 800 },
  { rank: 5, name: "Expert", minVolts: 1500 }, // provisoire
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
