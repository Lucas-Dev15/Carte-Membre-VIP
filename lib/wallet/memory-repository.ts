import type { WalletRepository } from "./repository";
import type { MemberCard, MemberSnapshot, WalletPass, WalletSyncJob } from "./types";

export class MemoryWalletRepository implements WalletRepository {
  members = new Map<string, MemberSnapshot>();
  cards = new Map<string, MemberCard>();
  passes = new Map<string, WalletPass>();
  jobs = new Map<string, WalletSyncJob>();
  deliveries = new Set<string>();
  auditLog: { actorId: string; action: string; targetId: string; details: Record<string, unknown>; at: Date }[] = [];
  alerts: { subject: string; details: Record<string, unknown> }[] = [];

  async getMemberSnapshot(id: string) {
    return this.members.get(id) ?? null;
  }
  async codeExists(code: string) {
    return [...this.cards.values()].some((c) => c.code === code);
  }
  async insertCard(card: MemberCard) {
    if (await this.codeExists(card.code)) throw new Error("UNIQUE violation: member_cards.code");
    if (card.status === "active" && (await this.getActiveCardByMember(card.memberId))) {
      throw new Error("UNIQUE violation: carte active déjà présente");
    }
    this.cards.set(card.id, { ...card });
  }
  async updateCard(card: MemberCard) {
    this.cards.set(card.id, { ...card });
  }
  async getCardById(id: string) {
    return this.cards.get(id) ?? null;
  }
  async getCardByCode(code: string) {
    return [...this.cards.values()].find((c) => c.code === code) ?? null;
  }
  async getActiveCardByMember(memberId: string) {
    return [...this.cards.values()].find((c) => c.memberId === memberId && c.status === "active") ?? null;
  }
  async countCardsForMember(memberId: string) {
    return [...this.cards.values()].filter((c) => c.memberId === memberId).length;
  }
  async getWalletPass(cardId: string) {
    return this.passes.get(cardId) ?? null;
  }
  async getWalletPassByInstance(instanceId: string) {
    return [...this.passes.values()].find((p) => p.psInstanceId === instanceId) ?? null;
  }
  async saveWalletPass(pass: WalletPass) {
    this.passes.set(pass.cardId, { ...pass });
  }
  async findQueuedJob(cardId: string) {
    return [...this.jobs.values()].find((j) => j.cardId === cardId && j.status === "queued") ?? null;
  }
  async saveJob(job: WalletSyncJob) {
    this.jobs.set(job.id, { ...job });
  }
  async dueJobs(now: Date, limit: number) {
    return [...this.jobs.values()]
      .filter((j) => j.status === "queued" && j.runAfter <= now)
      .sort((a, b) => a.runAfter.getTime() - b.runAfter.getTime())
      .slice(0, limit);
  }
  async jobsWaitingCredits() {
    return [...this.jobs.values()].filter((j) => j.status === "waiting_credits");
  }
  async markWebhookDelivery(id: string) {
    if (this.deliveries.has(id)) return false;
    this.deliveries.add(id);
    return true;
  }
  async audit(entry: { actorId: string; action: string; targetId: string; details: Record<string, unknown> }) {
    this.auditLog.push({ ...entry, at: new Date() });
  }
  async alertSuperAdmin(subject: string, details: Record<string, unknown>) {
    this.alerts.push({ subject, details });
    console.warn("[alerte super-admin]", subject, JSON.stringify(details));
  }
}
