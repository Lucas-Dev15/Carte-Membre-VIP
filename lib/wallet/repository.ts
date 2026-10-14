import type { MemberCard, MemberSnapshot, WalletPass, WalletSyncJob } from "./types";

/**
 * Accès aux données de la carte. L'implémentation de production s'appuie sur
 * les tables de db/schema.sql ; une implémentation en mémoire (lib/wallet/memory-repository.ts)
 * sert à la démo et aux tests.
 */
export interface WalletRepository {
  getMemberSnapshot(memberId: string): Promise<MemberSnapshot | null>;

  codeExists(code: string): Promise<boolean>; // cartes révoquées comprises
  insertCard(card: MemberCard): Promise<void>;
  updateCard(card: MemberCard): Promise<void>;
  getCardById(id: string): Promise<MemberCard | null>;
  getCardByCode(code: string): Promise<MemberCard | null>;
  getActiveCardByMember(memberId: string): Promise<MemberCard | null>;
  countCardsForMember(memberId: string): Promise<number>; // révoquées comprises

  getWalletPass(cardId: string): Promise<WalletPass | null>;
  getWalletPassByInstance(instanceId: string): Promise<WalletPass | null>;
  saveWalletPass(pass: WalletPass): Promise<void>;

  /** Job encore en file (status queued) pour cette carte, pour regroupement. */
  findQueuedJob(cardId: string): Promise<WalletSyncJob | null>;
  saveJob(job: WalletSyncJob): Promise<void>;
  dueJobs(now: Date, limit: number): Promise<WalletSyncJob[]>;
  jobsWaitingCredits(): Promise<WalletSyncJob[]>;

  /** Renvoie false si la livraison a déjà été traitée (dédoublonnage webhooks). */
  markWebhookDelivery(deliveryId: string): Promise<boolean>;

  audit(entry: { actorId: string; action: string; targetId: string; details: Record<string, unknown> }): Promise<void>;
  alertSuperAdmin(subject: string, details: Record<string, unknown>): Promise<void>;
}
