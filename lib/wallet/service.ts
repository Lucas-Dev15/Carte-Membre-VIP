import { randomUUID } from "node:crypto";
import { cardUrl, generateMemberCode } from "./code";
import { buildLocations, buildPassFields, fieldsHash, toPassStudioFields, type FieldKeyMap } from "./fields";
import { formatNotifWhen } from "./format";
import { levelFor } from "./levels";
import { PassStudioError, type PassStudioClient } from "./passstudio";
import type { WalletRepository } from "./repository";
import type { MemberCard, SyncReason, WalletPass, WalletSyncJob } from "./types";
import type { ParsedWebhookEvent } from "./webhook";

export interface WalletContext {
  repo: WalletRepository;
  client: PassStudioClient | null; // null : Pass Studio non configuré (démo)
  passId: string;
  siteUrl: string;
  /** Nos clés → clés réelles du pass (PASS_STUDIO_FIELD_KEYS). */
  fieldKeyMap?: FieldKeyMap;
  now?: () => Date;
}

const now = (ctx: WalletContext) => (ctx.now ? ctx.now() : new Date());

export const GROUPING_DELAY_MS = 2 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const CREDITS_RETRY_DELAY_MS = 15 * 60 * 1000;
/** 402 : on réessaie toutes les 15 min pendant 24 h avec le même externalRef. */
export const MAX_CREDIT_ATTEMPTS = 96;

/** Une seule notification par job : niveau > présence > réservation. */
const MESSAGE_PRIORITY: Record<SyncReason, number> = {
  level_up: 3,
  attendance: 2,
  booking: 1,
  booking_cleared: 0,
  volts_silent: 0,
  profile: 0,
  issue: 0,
  manual: 0,
};

// ---------------------------------------------------------------------------
// Création de carte et émission du pass
// ---------------------------------------------------------------------------

/**
 * À appeler à la création du compte. Crée la carte (code unique) puis tente
 * d'émettre le pass ; un échec d'émission ne fait JAMAIS échouer l'inscription :
 * il est mis en file.
 */
export async function createCardForMember(ctx: WalletContext, memberId: string): Promise<MemberCard> {
  const existing = await ctx.repo.getActiveCardByMember(memberId);
  if (existing) return existing; // idempotent

  const member = await ctx.repo.getMemberSnapshot(memberId);
  if (!member) throw new Error(`Membre introuvable : ${memberId}`);

  const code = await generateMemberCode(member.cityCode, (c) => ctx.repo.codeExists(c));
  const card: MemberCard = {
    id: randomUUID(),
    memberId,
    code,
    qrUrl: cardUrl(ctx.siteUrl, code),
    status: "active",
    createdAt: now(ctx),
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
  };
  await ctx.repo.insertCard(card);

  try {
    await ensureIssued(ctx, card);
  } catch (err) {
    console.warn("[wallet] émission différée", card.id, (err as Error).message);
    await enqueueSync(ctx, card.id, "issue");
  }
  return card;
}

function emptyPass(cardId: string, passId: string): WalletPass {
  return {
    cardId,
    psPassId: passId,
    psInstanceId: null,
    barcodeContent: null,
    addToWalletUrl: null,
    appleWalletUrl: null,
    googleWalletUrl: null,
    platform: null,
    installed: false,
    lastFieldsHash: null,
    lastPushedAt: null,
    lastPushStatus: null,
    lastError: null,
  };
}

/** Émet l'instance si elle n'existe pas encore (appel idempotent côté API). */
/**
 * L'émission est dédoublonnée par identifiant, dans l'ordre
 * holderId → email → phone → customerId (doc « Idempotency »).
 * - 1re carte : `member_<id>` + e-mail, comme dans la spécification.
 * - Carte régénérée : l'e-mail ramènerait l'ancienne instance (révoquée) ;
 *   on émet donc sans e-mail, avec un customerId propre à la nouvelle carte.
 *   Nos e-mails partent de toute façon de notre plateforme (sendEmail: false).
 */
async function issueIdentity(ctx: WalletContext, card: MemberCard, email: string) {
  const count = await ctx.repo.countCardsForMember(card.memberId);
  return count > 1
    ? { customerId: `member_${card.memberId}_${card.code}` }
    : { customerId: `member_${card.memberId}`, email };
}

export async function ensureIssued(ctx: WalletContext, card: MemberCard): Promise<WalletPass> {
  const current = await ctx.repo.getWalletPass(card.id);
  if (current?.psInstanceId) return current;
  if (!ctx.client) throw new Error("The Pass Studio n'est pas configuré");

  const member = await ctx.repo.getMemberSnapshot(card.memberId);
  if (!member) throw new Error(`Membre introuvable : ${card.memberId}`);

  const fields = buildPassFields(member, card.code);
  const locations = buildLocations(member);
  const { body } = await ctx.client.issue(
    ctx.passId,
    {
      ...(await issueIdentity(ctx, card, member.email)),
      source: "rdvia",
      name: fields.memberName,
      sendEmail: false,
      includeArtifacts: true,
      locale: "fr",
      barcodeValue: card.qrUrl,
      fields: toPassStudioFields(fields, ctx.fieldKeyMap ?? {}),
      ...(locations.length ? { locations } : {}),
    },
    `rdvia_issue_${card.id}`,
  );

  const pass: WalletPass = {
    ...(current ?? emptyPass(card.id, ctx.passId)),
    psInstanceId: body.instanceId,
    barcodeContent: body.barcodeContent ?? card.qrUrl,
    addToWalletUrl: body.addToWalletUrl ?? null,
    appleWalletUrl: body.artifacts?.appleWalletUrl ?? null,
    googleWalletUrl: body.artifacts?.googleWalletUrl ?? null,
    // Sur un doublon, les champs envoyés ne sont pas appliqués (doc) : on force un push.
    lastFieldsHash: body.alreadyExisted ? null : fieldsHash(fields, locations),
    lastPushedAt: now(ctx),
    lastPushStatus: body.alreadyExisted ? "issued_existing" : "issued",
    lastError: null,
  };
  await ctx.repo.saveWalletPass(pass);
  if (body.alreadyExisted) await enqueueSync(ctx, card.id, "manual");
  return pass;
}

// ---------------------------------------------------------------------------
// File de synchronisation
// ---------------------------------------------------------------------------

/** Ajoute (ou fusionne dans) le job en attente de la carte, exécuté 2 minutes plus tard. */
export async function enqueueSync(
  ctx: WalletContext,
  cardId: string,
  reason: SyncReason,
  message: string | null = null,
): Promise<WalletSyncJob> {
  const runAfter = new Date(now(ctx).getTime() + GROUPING_DELAY_MS);
  const queued = await ctx.repo.findQueuedJob(cardId);
  if (queued) {
    // On garde le message de plus haute priorité (à égalité : le plus récent).
    if (message && MESSAGE_PRIORITY[reason] >= MESSAGE_PRIORITY[queued.reason]) {
      queued.reason = reason;
      queued.message = message;
    } else if (!queued.message && MESSAGE_PRIORITY[reason] > MESSAGE_PRIORITY[queued.reason]) {
      queued.reason = reason;
    }
    queued.runAfter = runAfter;
    await ctx.repo.saveJob(queued);
    return queued;
  }
  const id = randomUUID();
  const job: WalletSyncJob = {
    id,
    cardId,
    reason,
    message,
    runAfter,
    attempts: 0,
    status: "queued",
    externalRef: `rdvia_sync_${id}`,
  };
  await ctx.repo.saveJob(job);
  return job;
}

export type JobOutcome = "pushed" | "no_change" | "issued" | "waiting_credits" | "retry" | "failed" | "skipped";

export async function runSyncJob(ctx: WalletContext, job: WalletSyncJob): Promise<JobOutcome> {
  const card = await ctx.repo.getCardById(job.cardId);
  if (!card || card.status !== "active") {
    await ctx.repo.saveJob({ ...job, status: "done" });
    return "skipped";
  }
  job.status = "running";
  job.attempts += 1;
  await ctx.repo.saveJob(job);

  try {
    let pass = await ctx.repo.getWalletPass(card.id);
    if (!pass?.psInstanceId) {
      await ensureIssued(ctx, card);
      await ctx.repo.saveJob({ ...job, status: "done" });
      return "issued";
    }
    if (!ctx.client) throw new Error("The Pass Studio n'est pas configuré");

    const member = await ctx.repo.getMemberSnapshot(card.memberId);
    if (!member) throw new Error(`Membre introuvable : ${card.memberId}`);
    const fields = buildPassFields(member, card.code);
    const locations = buildLocations(member);
    const hash = fieldsHash(fields, locations);

    if (hash === pass.lastFieldsHash) {
      await ctx.repo.saveJob({ ...job, status: "done" });
      return "no_change";
    }

    const res = await ctx.client.updateFields({
      instanceId: pass.psInstanceId,
      fields: toPassStudioFields(fields, ctx.fieldKeyMap ?? {}),
      ...(job.message ? { message: job.message } : {}),
      // 1 à 10 lieux propres au porteur ; null = retour aux lieux du modèle (aucun).
      locations: locations.length ? locations : null,
      externalRef: job.externalRef,
    });

    if (res.status === 202 || res.body?.pushSkipReason === "insufficient_credits") {
      // Crédits insuffisants : en attente, alerte, relance après rechargement.
      pass = { ...pass, lastPushStatus: "waiting_credits", lastError: "insufficient_credits" };
      await ctx.repo.saveWalletPass(pass);
      await ctx.repo.saveJob({ ...job, status: "waiting_credits" });
      await ctx.repo.alertSuperAdmin("Crédits The Pass Studio insuffisants", { jobId: job.id, requestId: res.requestId });
      return "waiting_credits";
    }

    const skipped = res.body?.pushSkipReason === "no_change";
    await ctx.repo.saveWalletPass({
      ...pass,
      lastFieldsHash: hash,
      lastPushedAt: now(ctx),
      lastPushStatus: skipped ? "no_change" : "pushed",
      lastError: null,
    });
    await ctx.repo.saveJob({ ...job, status: "done" });
    return skipped ? "no_change" : "pushed";
  } catch (err) {
    return handleJobError(ctx, job, err);
  }
}

async function handleJobError(ctx: WalletContext, job: WalletSyncJob, err: unknown): Promise<JobOutcome> {
  const e = err instanceof PassStudioError ? err : null;
  const pass = await ctx.repo.getWalletPass(job.cardId);
  if (pass) {
    await ctx.repo.saveWalletPass({
      ...pass,
      lastPushStatus: `error_${e?.status ?? "internal"}`,
      lastError: e ? `${e.code ?? e.status} ${e.message} (request ${e.requestId ?? "?"})` : String(err),
    });
  }

  const retryLater = (delayMs: number) =>
    ctx.repo.saveJob({ ...job, status: "queued", runAfter: new Date(now(ctx).getTime() + delayMs) });

  // 429 : on attend Retry-After (≤ 60 s) plus un peu d'aléa ; ne compte pas comme une tentative.
  if (e?.status === 429) {
    job.attempts -= 1;
    await retryLater((e.retryAfterSec ?? 60) * 1000 + Math.floor(Math.random() * 5000));
    return "retry";
  }
  // 402 sur un appel avec message : rien n'est appliqué et la ref n'est pas consommée,
  // on réessaie plus tard avec le MÊME externalRef.
  if (e?.status === 402 && job.attempts < MAX_CREDIT_ATTEMPTS) {
    if (job.attempts === 1) {
      await ctx.repo.alertSuperAdmin("Crédits The Pass Studio insuffisants", { jobId: job.id, requestId: e.requestId });
    }
    await retryLater(CREDITS_RETRY_DELAY_MS);
    return "retry";
  }
  const retryable = e ? e.retryable : true; // erreur réseau : on retente (appels idempotents)
  if (retryable && job.attempts < MAX_ATTEMPTS) {
    await retryLater(2 ** job.attempts * 30_000); // 1 min, 2 min, 4 min, 8 min
    return "retry";
  }
  await ctx.repo.saveJob({ ...job, status: "failed" });
  await ctx.repo.alertSuperAdmin("Synchronisation wallet en échec", {
    jobId: job.id,
    cardId: job.cardId,
    status: e?.status,
    code: e?.code,
    requestId: e?.requestId,
  });
  return "failed";
}

/** Traite les jobs échus, un par un, en espaçant les appels (rate limits). */
export async function processDueJobs(
  ctx: WalletContext,
  opts: { limit?: number; intervalMs?: number } = {},
): Promise<Record<string, JobOutcome>> {
  const jobs = await ctx.repo.dueJobs(now(ctx), opts.limit ?? 100);
  const results: Record<string, JobOutcome> = {};
  for (const [i, job] of jobs.entries()) {
    if (i > 0 && opts.intervalMs) await new Promise((r) => setTimeout(r, opts.intervalMs));
    results[job.id] = await runSyncJob(ctx, job);
  }
  return results;
}

/** À appeler quand les crédits ont été rechargés : relance avec un NOUVEL externalRef. */
export async function resumeJobsAfterCredits(ctx: WalletContext): Promise<number> {
  const jobs = await ctx.repo.jobsWaitingCredits();
  for (const job of jobs) {
    await ctx.repo.saveJob({
      ...job,
      status: "queued",
      attempts: 0,
      runAfter: now(ctx),
      externalRef: `rdvia_sync_${job.id}_${now(ctx).getTime()}`,
    });
  }
  return jobs.length;
}

/**
 * À appeler par le cron : si des jobs attendent des crédits et que le solde
 * (GET /me → billing.credits) est de nouveau positif, on les relance.
 */
export async function resumeIfCreditsAvailable(ctx: WalletContext): Promise<number> {
  if (!ctx.client) return 0;
  if ((await ctx.repo.jobsWaitingCredits()).length === 0) return 0;
  const { body } = await ctx.client.getMe();
  if ((body.billing?.credits ?? 0) <= 0) return 0;
  return resumeJobsAfterCredits(ctx);
}

// ---------------------------------------------------------------------------
// Événements métier → jobs (§7.1)
// ---------------------------------------------------------------------------

async function activeCardId(ctx: WalletContext, memberId: string): Promise<string | null> {
  return (await ctx.repo.getActiveCardByMember(memberId))?.id ?? null;
}

export type VoltsSource = "attendance" | "referral" | "survey" | "replay" | "badge" | "new_city" | "early_booking";

/**
 * Appelée APRÈS l'écriture des volts en base. Envoie une notification pour la
 * présence/le parrainage et le passage de niveau ; silencieuse sinon.
 */
export async function onVoltsAwarded(
  ctx: WalletContext,
  memberId: string,
  params: { before: number; after: number; source: VoltsSource },
): Promise<void> {
  const cardId = await activeCardId(ctx, memberId);
  if (!cardId) return;
  const delta = params.after - params.before;
  if (params.source === "attendance") {
    await enqueueSync(ctx, cardId, "attendance", `+${delta} skills ! Vous en avez maintenant ${params.after}.`);
  } else if (params.source === "referral") {
    await enqueueSync(ctx, cardId, "attendance", `+${delta} skills grâce à votre filleul !`);
  } else {
    await enqueueSync(ctx, cardId, "volts_silent");
  }
  const lvBefore = levelFor(params.before);
  const lvAfter = levelFor(params.after);
  if (lvAfter.rank > lvBefore.rank) {
    await enqueueSync(ctx, cardId, "level_up", `Niveau ${lvAfter.rank} · ${lvAfter.name} atteint, bravo !`);
  }
}

/** Réservation confirmée ou promotion depuis la liste d'attente. */
export async function onBookingConfirmed(
  ctx: WalletContext,
  memberId: string,
  booking: { conferenceTitle: string; startsAt: Date },
): Promise<void> {
  const cardId = await activeCardId(ctx, memberId);
  if (!cardId) return;
  await enqueueSync(
    ctx,
    cardId,
    "booking",
    `Place confirmée : ${booking.conferenceTitle}, ${formatNotifWhen(booking.startsAt)}.`,
  );
}

/** Annulation, conférence passée, changement de nom ou de ville : mise à jour silencieuse. */
export async function onSilentChange(
  ctx: WalletContext,
  memberId: string,
  reason: "booking_cleared" | "profile",
): Promise<void> {
  const cardId = await activeCardId(ctx, memberId);
  if (cardId) await enqueueSync(ctx, cardId, reason);
}
// Formation échangée : aucun appel (le pass affiche les volts cumulés).

// ---------------------------------------------------------------------------
// Webhooks (§8)
// ---------------------------------------------------------------------------

export async function applyWebhookEvent(ctx: WalletContext, event: ParsedWebhookEvent): Promise<void> {
  if (!event.instanceId) return;
  const pass = await ctx.repo.getWalletPassByInstance(event.instanceId);
  if (!pass) return;
  if (event.type === "pass.issued") {
    await ctx.repo.saveWalletPass({ ...pass, installed: true, platform: event.platform ?? pass.platform });
  } else if (event.type === "pass.removed") {
    await ctx.repo.saveWalletPass({ ...pass, installed: false });
  } else if (event.type === "pass.updated") {
    console.info("[wallet] pass.updated", event.instanceId, event.id);
  }
}

// ---------------------------------------------------------------------------
// Révocation et régénération (§9)
// ---------------------------------------------------------------------------

export async function revokeAndRegenerate(
  ctx: WalletContext,
  params: { cardId: string; actorId: string; reason: string },
): Promise<MemberCard> {
  if (!params.reason.trim()) throw new Error("Le motif est obligatoire");
  const old = await ctx.repo.getCardById(params.cardId);
  if (!old || old.status !== "active") throw new Error("Carte introuvable ou déjà révoquée");

  const oldPass = await ctx.repo.getWalletPass(old.id);
  if (oldPass?.psInstanceId && ctx.client) {
    await ctx.client.revoke(oldPass.psInstanceId, params.reason);
  }
  const at = now(ctx);
  await ctx.repo.updateCard({
    ...old,
    status: "revoked",
    revokedAt: at,
    revokedBy: params.actorId,
    revokeReason: params.reason,
  });

  const member = await ctx.repo.getMemberSnapshot(old.memberId);
  if (!member) throw new Error(`Membre introuvable : ${old.memberId}`);
  const code = await generateMemberCode(member.cityCode, (c) => ctx.repo.codeExists(c));
  const card: MemberCard = {
    id: randomUUID(),
    memberId: old.memberId,
    code,
    qrUrl: cardUrl(ctx.siteUrl, code),
    status: "active",
    createdAt: at,
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
  };
  await ctx.repo.insertCard(card);
  await ctx.repo.audit({
    actorId: params.actorId,
    action: "member_card.revoke_regenerate",
    targetId: old.memberId,
    details: { oldCardId: old.id, oldCode: old.code, newCardId: card.id, newCode: code, reason: params.reason },
  });

  try {
    await ensureIssued(ctx, card);
  } catch (err) {
    console.warn("[wallet] émission différée après régénération", (err as Error).message);
    await enqueueSync(ctx, card.id, "issue");
  }
  return card;
}
