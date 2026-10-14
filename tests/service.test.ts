import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryWalletRepository } from "../lib/wallet/memory-repository";
import { PassStudioClient } from "../lib/wallet/passstudio";
import {
  applyWebhookEvent,
  createCardForMember,
  enqueueSync,
  onBookingConfirmed,
  onVoltsAwarded,
  processDueJobs,
  revokeAndRegenerate,
  type WalletContext,
} from "../lib/wallet/service";

type Call = { method: string; path: string; body: any };

function fakeApi(handler: (c: Call) => { status: number; body: unknown }) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
    const call = { method: init.method!, path: url.replace("https://api.test", ""), body: init.body ? JSON.parse(String(init.body)) : null };
    calls.push(call);
    const r = handler(call);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "x-request-id": "req_1" } });
  }) as unknown as typeof fetch;
  return { calls, client: new PassStudioClient({ apiKey: "ps_test", baseUrl: "https://api.test", fetchImpl }) };
}

let clock = new Date("2026-10-14T10:00:00Z");
let repo: MemoryWalletRepository;
let instanceCounter = 0;
const okHandler = (c: Call) => {
  if (c.path.endsWith("/issue"))
    return {
      status: 200,
      body: {
        instanceId: `inst_${++instanceCounter}`,
        barcodeContent: c.body.barcodeValue,
        addToWalletUrl: "https://pass/add",
        artifacts: { appleWalletUrl: "https://pass/apple", googleWalletUrl: "https://pass/google" },
      },
    };
  return { status: 200, body: {} };
};

function ctxWith(client: PassStudioClient | null): WalletContext {
  return { repo, client, passId: "pass_1", siteUrl: "https://rendezvousia.fr", now: () => clock };
}

beforeEach(() => {
  clock = new Date("2026-10-14T10:00:00Z");
  instanceCounter = 0;
  repo = new MemoryWalletRepository();
  repo.members.set("m1", {
    memberId: "m1",
    firstName: "Manon",
    lastName: "Blanc",
    email: "manon@exemple.fr",
    city: "Nancy",
    cityCode: "NCY",
    voltsTotal: 760,
    createdAt: new Date("2026-03-09T10:00:00Z"),
    nextBooking: null,
  });
});

const advance = (ms: number) => (clock = new Date(clock.getTime() + ms));

describe("création et émission", () => {
  it("crée une carte, émet le pass et reste idempotente", async () => {
    const { client, calls } = fakeApi(okHandler);
    const ctx = ctxWith(client);
    const card = await createCardForMember(ctx, "m1");
    expect(card.code).toMatch(/^RVIA-NCY-\d{4}$/);
    expect(card.qrUrl).toBe(`https://rendezvousia.fr/carte/${card.code}`);
    const issue = calls[0];
    expect(issue.path).toBe("/passes/pass_1/issue");
    expect(issue.body).toMatchObject({ customerId: "member_m1", sendEmail: false, locale: "fr", barcodeValue: card.qrUrl });
    expect(issue.body.fields.memberCode).toBe(card.code);
    const pass = await repo.getWalletPass(card.id);
    expect(pass).toMatchObject({ psInstanceId: "inst_1", appleWalletUrl: "https://pass/apple", googleWalletUrl: "https://pass/google" });

    expect((await createCardForMember(ctx, "m1")).id).toBe(card.id);
    expect(calls).toHaveLength(1);
  });

  it("ne fait pas échouer l'inscription si l'émission échoue", async () => {
    const { client } = fakeApi(() => ({ status: 503, body: { code: "unavailable", retryable: true } }));
    const ctx = ctxWith(client);
    const card = await createCardForMember(ctx, "m1");
    expect(card.status).toBe("active");
    expect(await repo.findQueuedJob(card.id)).toMatchObject({ reason: "issue" });
  });
});

describe("synchronisation", () => {
  it("regroupe, garde le message prioritaire et ne pousse qu'une fois", async () => {
    const { client, calls } = fakeApi(okHandler);
    const ctx = ctxWith(client);
    const card = await createCardForMember(ctx, "m1");
    calls.length = 0;

    repo.members.get("m1")!.voltsTotal = 860;
    await onVoltsAwarded(ctx, "m1", { before: 760, after: 860, source: "attendance" });
    expect(await processDueJobs(ctx)).toEqual({}); // pas avant 2 minutes

    advance(2 * 60_000);
    const results = await processDueJobs(ctx);
    expect(Object.values(results)).toEqual(["pushed"]);
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("/instances/fields");
    expect(calls[0].body.message).toBe("Niveau 4 · Praticien atteint, bravo !");
    expect(calls[0].body.fields).toMatchObject({ volts: "860", level: "4 · Praticien" });
    expect(calls[0].body.externalRef).toMatch(/^rdvia_sync_/);
    void card;
  });

  it("ne pousse rien quand rien n'a changé", async () => {
    const { client, calls } = fakeApi(okHandler);
    const ctx = ctxWith(client);
    const card = await createCardForMember(ctx, "m1");
    calls.length = 0;
    await enqueueSync(ctx, card.id, "profile");
    advance(2 * 60_000);
    expect(Object.values(await processDueJobs(ctx))).toEqual(["no_change"]);
    expect(calls).toHaveLength(0);
  });

  it("envoie le lieu à la réservation et la notification", async () => {
    const { client, calls } = fakeApi(okHandler);
    const ctx = ctxWith(client);
    await createCardForMember(ctx, "m1");
    calls.length = 0;
    const startsAt = new Date("2026-11-12T17:30:00Z");
    repo.members.get("m1")!.nextBooking = {
      conferenceTitle: "Créer ses visuels avec l'IA",
      startsAt,
      city: "Nancy",
      venue: { name: "Le Lieu", address: "", latitude: 48.69, longitude: 6.18 },
    };
    await onBookingConfirmed(ctx, "m1", { conferenceTitle: "Créer ses visuels avec l'IA", startsAt });
    advance(2 * 60_000);
    await processDueJobs(ctx);
    expect(calls[0].body.message).toBe("Place confirmée : Créer ses visuels avec l'IA, jeu. 12 nov. à 18 h 30.");
    expect(calls[0].body.locations).toEqual([
      { latitude: 48.69, longitude: 6.18, name: "Le Lieu", relevantText: "Les RDV IA : présentez votre carte à l'accueil" },
    ]);
  });

  it("met en attente de crédits sur 202 et alerte", async () => {
    let credits = false;
    const { client } = fakeApi((c) => (c.path === "/instances/fields" && !credits ? { status: 202, body: {} } : okHandler(c)));
    const ctx = ctxWith(client);
    const card = await createCardForMember(ctx, "m1");
    repo.members.get("m1")!.voltsTotal = 780;
    await enqueueSync(ctx, card.id, "volts_silent");
    advance(2 * 60_000);
    expect(Object.values(await processDueJobs(ctx))).toEqual(["waiting_credits"]);
    expect(repo.alerts).toHaveLength(1);
    credits = true;
  });

  it("réessaie les 5xx avec backoff puis échoue après 5 tentatives", async () => {
    let fail = false;
    const { client } = fakeApi((c) =>
      fail && c.path === "/instances/fields" ? { status: 500, body: { code: "internal", retryable: true } } : okHandler(c),
    );
    const ctx = ctxWith(client);
    const card = await createCardForMember(ctx, "m1");
    fail = true;
    repo.members.get("m1")!.voltsTotal = 780;
    await enqueueSync(ctx, card.id, "volts_silent");
    const outcomes: string[] = [];
    for (let i = 0; i < 6; i++) {
      advance(60 * 60_000);
      outcomes.push(...Object.values(await processDueJobs(ctx)));
    }
    expect(outcomes).toEqual(["retry", "retry", "retry", "retry", "failed"]);
    expect(repo.alerts.at(-1)?.subject).toBe("Synchronisation wallet en échec");
  });
});

describe("webhooks et révocation", () => {
  it("met à jour le wallet utilisé", async () => {
    const { client } = fakeApi(okHandler);
    const ctx = ctxWith(client);
    const card = await createCardForMember(ctx, "m1");
    await applyWebhookEvent(ctx, { id: "e1", type: "pass.issued", instanceId: "inst_1", passId: "pass_1", platform: "google" });
    expect(await repo.getWalletPass(card.id)).toMatchObject({ installed: true, platform: "google" });
    await applyWebhookEvent(ctx, { id: "e2", type: "pass.removed", instanceId: "inst_1", passId: "pass_1", platform: null });
    expect((await repo.getWalletPass(card.id))?.installed).toBe(false);
  });

  it("révoque, régénère avec un nouveau code et journalise", async () => {
    const { client, calls } = fakeApi(okHandler);
    const ctx = ctxWith(client);
    const old = await createCardForMember(ctx, "m1");
    await expect(revokeAndRegenerate(ctx, { cardId: old.id, actorId: "admin", reason: " " })).rejects.toThrow();
    const fresh = await revokeAndRegenerate(ctx, { cardId: old.id, actorId: "admin", reason: "Perte du téléphone" });

    expect(fresh.code).not.toBe(old.code);
    expect((await repo.getCardById(old.id))?.status).toBe("revoked");
    expect(calls.map((c) => c.path)).toEqual(["/passes/pass_1/issue", "/instances/revoke", "/passes/pass_1/issue"]);
    expect(calls[1].body.instanceId).toBe("inst_1");
    expect(calls[2].body.customerId).toBe(`member_m1_${fresh.code}`);
    expect(repo.auditLog[0]).toMatchObject({ actorId: "admin", action: "member_card.revoke_regenerate" });
    expect(await repo.codeExists(old.code)).toBe(true); // jamais réattribué
  });
});
