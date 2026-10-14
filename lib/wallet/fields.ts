import { createHash } from "node:crypto";
import { levelLabel, progressLabel } from "./levels";
import { formatLongWhen, formatMonthYear, formatShortWhen } from "./format";
import type { MemberSnapshot } from "./types";

/** Clés par porteur créées dans l'éditeur The Pass Studio (§3.3). */
export const HOLDER_FIELD_KEYS = [
  "level",
  "volts",
  "progress",
  "memberName",
  "city",
  "nextTitle",
  "nextWhen",
  "nextFull",
  "memberSince",
  "memberCode",
] as const;

/** Clé gérée au niveau du modèle (templateOwnedFieldKeys). */
export const TEMPLATE_FIELD_KEYS = ["howTo"] as const;

export const HOW_TO_TEXT =
  "Présence +100 · Questionnaire +20 · Replay +15 · Réservation anticipée +10. Vous ne perdez jamais un skill.";

export type HolderFieldKey = (typeof HOLDER_FIELD_KEYS)[number];
export type PassFields = Record<HolderFieldKey, string>;

export interface PassLocation {
  latitude: number;
  longitude: number;
  name: string;
  relevantText: string;
}

export const RELEVANT_TEXT = "Les RDV IA : présentez votre carte à l'accueil";

export function buildPassFields(member: MemberSnapshot, memberCode: string): PassFields {
  const b = member.nextBooking;
  return {
    level: levelLabel(member.voltsTotal),
    volts: String(member.voltsTotal),
    progress: progressLabel(member.voltsTotal),
    memberName: `${member.firstName} ${member.lastName}`.trim(),
    city: member.city,
    nextTitle: b ? b.conferenceTitle : "Aucune réservation",
    nextWhen: b ? formatShortWhen(b.startsAt) : "Réservez sur rendezvousia.fr",
    nextFull: b ? `${formatLongWhen(b.startsAt)} · ${b.venue.name}, ${b.city}` : "Aucune réservation",
    memberSince: formatMonthYear(member.createdAt),
    memberCode,
  };
}

export function buildLocations(member: MemberSnapshot): PassLocation[] {
  const b = member.nextBooking;
  if (!b) return [];
  return [
    {
      latitude: b.venue.latitude,
      longitude: b.venue.longitude,
      name: b.venue.name,
      relevantText: RELEVANT_TEXT,
    },
  ];
}

/** Hash stable des champs + lieux : sert à ne pousser que s'il y a un changement. */
export function fieldsHash(fields: PassFields, locations: PassLocation[]): string {
  const ordered = HOLDER_FIELD_KEYS.map((k) => [k, fields[k]]);
  return createHash("sha256").update(JSON.stringify({ f: ordered, l: locations })).digest("hex");
}

/**
 * Nos clés logiques → clés RÉELLES du pass The Pass Studio.
 * Sur un pass « custom », l'éditeur génère des clés stables du type
 * `field_1787677019449` ; une clé inconnue fait échouer tout l'appel
 * (400 unknown_field_key). `npm run wallet:setup` propose la correspondance
 * à mettre dans PASS_STUDIO_FIELD_KEYS (JSON). Clé absente = même nom.
 */
export type FieldKeyMap = Partial<Record<HolderFieldKey | (typeof TEMPLATE_FIELD_KEYS)[number], string>>;

export function parseFieldKeyMap(raw: string | undefined): FieldKeyMap {
  if (!raw) return {};
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const known = new Set<string>([...HOLDER_FIELD_KEYS, ...TEMPLATE_FIELD_KEYS]);
  const out: FieldKeyMap = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (!known.has(k)) throw new Error(`PASS_STUDIO_FIELD_KEYS : clé inconnue « ${k} »`);
    if (typeof v !== "string" || !v) throw new Error(`PASS_STUDIO_FIELD_KEYS : valeur invalide pour « ${k} »`);
    (out as Record<string, string>)[k] = v;
  }
  return out;
}

export function toPassStudioFields(fields: Partial<PassFields>, map: FieldKeyMap): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) out[map[k as HolderFieldKey] ?? k] = v;
  }
  return out;
}

/**
 * Disposition du pass Custom (validée) : emplacement Apple de chaque champ.
 * Sur un pass Custom, `design.fields` = lignes { key, label, value, position } (format lu dans le
 * générateur de The Pass Studio, non documenté) ; `wallet:setup -- --fields` les écrit.
 */
export const PASS_LAYOUT: { key: HolderFieldKey | "howTo"; label: string; position: "header" | "primary" | "secondary" | "auxiliary" | "back" }[] = [
  { key: "level", label: "NIVEAU", position: "header" },
  { key: "volts", label: "MES SKILLS", position: "primary" },
  { key: "memberName", label: "MEMBRE", position: "secondary" },
  { key: "city", label: "VILLE", position: "secondary" },
  { key: "nextTitle", label: "PROCHAINE CONFÉRENCE", position: "auxiliary" },
  { key: "nextWhen", label: "LE", position: "auxiliary" },
  { key: "progress", label: "PROGRESSION", position: "back" },
  { key: "memberSince", label: "MEMBRE DEPUIS", position: "back" },
  { key: "memberCode", label: "CODE MEMBRE", position: "back" },
  { key: "nextFull", label: "PROCHAINE CONFÉRENCE (VERSO)", position: "back" },
  { key: "howTo", label: "GAGNER DES SKILLS", position: "back" },
];

/** Libellés de la maquette (§3.3), pour retrouver les clés par libellé dans l'éditeur. */
export const FIELD_LABELS: Record<HolderFieldKey | "howTo", string[]> = {
  level: ["NIVEAU"],
  volts: ["MES SKILLS", "MES VOLTS"], // « Skills » : ancien nom « Volts »
  progress: ["PROGRESSION"],
  memberName: ["MEMBRE"],
  city: ["VILLE"],
  nextTitle: ["PROCHAINE CONFÉRENCE"],
  nextWhen: ["LE"],
  nextFull: ["PROCHAINE CONFÉRENCE (VERSO)", "PROCHAINE CONFÉRENCE"],
  memberSince: ["MEMBRE DEPUIS"],
  memberCode: ["CODE MEMBRE"],
  howTo: ["GAGNER DES SKILLS", "GAGNER DES VOLTS"],
};
