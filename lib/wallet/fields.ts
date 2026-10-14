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
  "Présence +100 · Questionnaire +20 · Replay +15 · Réservation anticipée +10. Vous ne perdez jamais un volt.";

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
