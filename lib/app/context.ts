/**
 * Câblage serveur. En l'absence de base de données, un dépôt en mémoire
 * pré-rempli avec le membre de la maquette (Manon Blanc) sert de démo.
 * Remplacez `getRepository()` par l'implémentation SQL (db/schema.sql).
 */
import { cardUrl } from "../wallet/code";
import { isPassStudioConfigured, siteUrl } from "../wallet/config";
import { parseFieldKeyMap } from "../wallet/fields";
import { MemoryWalletRepository } from "../wallet/memory-repository";
import { getPassStudioClient } from "../wallet/passstudio";
import type { WalletRepository } from "../wallet/repository";
import type { WalletContext } from "../wallet/service";

export const DEMO_MEMBER_ID = "demo-manon";

function seed(repo: MemoryWalletRepository) {
  repo.members.set(DEMO_MEMBER_ID, {
    memberId: DEMO_MEMBER_ID,
    firstName: "Manon",
    lastName: "Blanc",
    email: "manon.blanc@exemple.fr",
    city: "Nancy",
    cityCode: "NCY",
    voltsTotal: 760,
    createdAt: new Date("2026-03-09T10:00:00+01:00"),
    nextBooking: {
      conferenceTitle: "Créer ses visuels avec l’IA",
      startsAt: new Date("2026-11-12T18:30:00+01:00"),
      city: "Nancy",
      venue: { name: "[Lieu partenaire]", address: "Nancy", latitude: 48.6921, longitude: 6.1844 },
    },
  });
  const code = "RVIA-NCY-1259";
  repo.cards.set("demo-card", {
    id: "demo-card",
    memberId: DEMO_MEMBER_ID,
    code,
    qrUrl: cardUrl(siteUrl(), code),
    status: "active",
    createdAt: new Date("2026-03-09T10:00:00+01:00"),
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
  });
}

const g = globalThis as unknown as { __rdviaRepo?: MemoryWalletRepository };

export function getRepository(): WalletRepository {
  if (!g.__rdviaRepo) {
    g.__rdviaRepo = new MemoryWalletRepository();
    seed(g.__rdviaRepo);
  }
  return g.__rdviaRepo;
}

export async function getWalletContext(): Promise<WalletContext> {
  const configured = isPassStudioConfigured();
  return {
    repo: getRepository(),
    client: configured ? await getPassStudioClient() : null,
    passId: process.env.PASS_STUDIO_PASS_ID ?? "",
    siteUrl: siteUrl(),
    fieldKeyMap: parseFieldKeyMap(process.env.PASS_STUDIO_FIELD_KEYS),
  };
}
