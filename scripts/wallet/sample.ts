import type { MemberSnapshot } from "../../lib/wallet/types";

/** Membre de la maquette (Manon Blanc), pour la carte de démo et les valeurs de test du modèle. */
export const SAMPLE_CODE = "RVIA-NCY-1259";

export function sampleMember(volts: number): MemberSnapshot {
  return {
    memberId: "demo-manon",
    firstName: "Manon",
    lastName: "Blanc",
    email: "manon.blanc@exemple.fr",
    city: "Nancy",
    cityCode: "NCY",
    voltsTotal: volts,
    createdAt: new Date("2026-03-09T10:00:00+01:00"),
    nextBooking: {
      conferenceTitle: "Créer ses visuels avec l’IA",
      startsAt: new Date("2026-11-12T18:30:00+01:00"),
      city: "Nancy",
      venue: { name: "[Lieu partenaire]", address: "Nancy", latitude: 48.6921, longitude: 6.1844 },
    },
  };
}

/** Membres de démo : `npm run wallet:demo -- issue --member lorenzo`. */
export const DEMO_MEMBERS: Record<string, { code: string; startVolts: number; build: (volts: number) => MemberSnapshot }> = {
  manon: { code: SAMPLE_CODE, startVolts: 760, build: sampleMember },
  lorenzo: {
    code: "RVIA-NCY-2048",
    startVolts: 1000,
    build: (volts) => ({
      memberId: "demo-lorenzo",
      firstName: "Lorenzo",
      lastName: "THOMAS",
      email: "lorenzo.thomas@exemple.fr",
      city: "Nancy",
      cityCode: "NCY",
      voltsTotal: volts,
      createdAt: new Date("2026-10-14T15:00:00+02:00"),
      nextBooking: {
        conferenceTitle: "Automatiser son quotidien avec l’IA",
        startsAt: new Date("2026-11-26T18:30:00+01:00"),
        city: "Nancy",
        venue: { name: "[Lieu partenaire]", address: "Nancy", latitude: 48.6921, longitude: 6.1844 },
      },
    }),
  },
};
