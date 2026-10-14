import { describe, expect, it } from "vitest";
import { buildPassFields, fieldsHash, buildLocations } from "../lib/wallet/fields";
import { formatLongWhen, formatMonthYear, formatShortWhen, formatNotifWhen } from "../lib/wallet/format";
import { levelLabel, progressLabel } from "../lib/wallet/levels";
import { generateMemberCode, isValidMemberCode } from "../lib/wallet/code";
import type { MemberSnapshot } from "../lib/wallet/types";

const manon: MemberSnapshot = {
  memberId: "m1",
  firstName: "Manon",
  lastName: "Blanc",
  email: "manon@exemple.fr",
  city: "Nancy",
  cityCode: "NCY",
  voltsTotal: 760,
  createdAt: new Date("2026-03-09T10:00:00+01:00"),
  nextBooking: {
    conferenceTitle: "Créer ses visuels avec l'IA",
    startsAt: new Date("2026-11-12T18:30:00+01:00"),
    city: "Nancy",
    venue: { name: "[Lieu]", address: "", latitude: 48.6921, longitude: 6.1844 },
  },
};

describe("formats", () => {
  it("formate les dates en français, fuseau Paris", () => {
    const d = new Date("2026-11-12T17:30:00Z");
    expect(formatShortWhen(d)).toBe("12 nov. · 18 h 30");
    expect(formatLongWhen(d)).toBe("jeu. 12 nov. 2026 · 18 h 30");
    expect(formatNotifWhen(d)).toBe("jeu. 12 nov. à 18 h 30");
    expect(formatMonthYear(new Date("2026-03-09T10:00:00Z"))).toBe("mars 2026");
    expect(formatShortWhen(new Date("2026-06-05T07:00:00Z"))).toBe("5 juin · 9 h");
  });
});

describe("niveaux", () => {
  it("correspond à la maquette", () => {
    expect(levelLabel(760)).toBe("3 · Explorateur");
    expect(progressLabel(760)).toBe("Encore 40 skills pour Praticien");
    expect(progressLabel(10_000)).toBe("Niveau maximum atteint");
  });
});

describe("champs du pass", () => {
  it("produit exactement les valeurs du §6.1", () => {
    expect(buildPassFields(manon, "RVIA-NCY-1259")).toEqual({
      level: "3 · Explorateur",
      volts: "760",
      progress: "Encore 40 skills pour Praticien",
      memberName: "Manon Blanc",
      city: "Nancy",
      nextTitle: "Créer ses visuels avec l'IA",
      nextWhen: "12 nov. · 18 h 30",
      nextFull: "jeu. 12 nov. 2026 · 18 h 30 · [Lieu], Nancy",
      memberSince: "mars 2026",
      memberCode: "RVIA-NCY-1259",
    });
  });

  it("gère l'absence de réservation", () => {
    const f = buildPassFields({ ...manon, nextBooking: null }, "RVIA-NCY-1259");
    expect(f.nextTitle).toBe("Aucune réservation");
    expect(f.nextWhen).toBe("Réservez sur rendezvousia.fr");
    expect(buildLocations({ ...manon, nextBooking: null })).toEqual([]);
  });

  it("hash stable, sensible aux changements", () => {
    const f = buildPassFields(manon, "RVIA-NCY-1259");
    const l = buildLocations(manon);
    expect(fieldsHash(f, l)).toBe(fieldsHash({ ...f }, [...l]));
    expect(fieldsHash(f, l)).not.toBe(fieldsHash({ ...f, volts: "860" }, l));
    expect(fieldsHash(f, l)).not.toBe(fieldsHash(f, []));
  });
});

describe("code membre", () => {
  it("respecte le format et évite les codes existants", async () => {
    const taken = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const c = await generateMemberCode("ncy", async (x) => taken.has(x));
      expect(isValidMemberCode(c)).toBe(true);
      expect(c.startsWith("RVIA-NCY-")).toBe(true);
      expect(taken.has(c)).toBe(false);
      taken.add(c);
    }
  });
});

describe("paliers", () => {
  it("couvrent chaque niveau", () => {
    expect([0, 199, 200, 449, 450, 799, 800, 1299, 1300].map(levelLabel)).toEqual([
      "1 · Curieux", "1 · Curieux", "2 · Initié", "2 · Initié", "3 · Explorateur",
      "3 · Explorateur", "4 · Praticien", "4 · Praticien", "5 · Expert",
    ]);
    expect(progressLabel(1250)).toBe("Encore 50 skills pour Expert");
  });
});
