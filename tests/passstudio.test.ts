import { describe, expect, it } from "vitest";
import { PassStudioClient, PassStudioError } from "../lib/wallet/passstudio";

function clientReturning(status: number, body: unknown, headers: Record<string, string> = {}) {
  const seen: { headers?: Record<string, string> } = {};
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    seen.headers = init.headers as Record<string, string>;
    return new Response(body === null ? "" : JSON.stringify(body), { status, headers });
  }) as unknown as typeof fetch;
  return { seen, client: new PassStudioClient({ apiKey: "ps_test_x", baseUrl: "https://api.test", fetchImpl }) };
}

async function errorOf(p: Promise<unknown>): Promise<PassStudioError> {
  try {
    await p;
  } catch (e) {
    return e as PassStudioError;
  }
  throw new Error("pas d'erreur");
}

describe("client The Pass Studio", () => {
  it("envoie le Bearer et notre X-Request-Id", async () => {
    const { client, seen } = clientReturning(200, { ok: true });
    await client.updateFields({ instanceId: "i", fields: {}, externalRef: "rdvia_sync_abc" });
    expect(seen.headers?.Authorization).toBe("Bearer ps_test_x");
    expect(seen.headers?.["X-Request-Id"]).toBe("rdvia_sync_abc");
  });

  it("lit le format d'erreur documenté", async () => {
    const { client } = clientReturning(400, { error: "Unknown key volts", code: "unknown_field_key", requestId: "r1" });
    const e = await errorOf(client.updateFields({ instanceId: "i", fields: { volts: "1" }, externalRef: "x" }));
    expect(e).toMatchObject({ status: 400, code: "unknown_field_key", requestId: "r1", retryable: false, message: "Unknown key volts" });
  });

  it("un 500 n'est réessayable que s'il le dit", async () => {
    const a = await errorOf(clientReturning(500, { error: "x", code: "internal_error" }).client.getMe());
    const b = await errorOf(clientReturning(500, { error: "x", code: "internal_error", retryable: true }).client.getMe());
    expect([a.retryable, b.retryable]).toEqual([false, true]);
  });

  it("429 : réessayable avec Retry-After", async () => {
    const e = await errorOf(clientReturning(429, { error: "x", code: "rate_limited" }, { "retry-after": "12" }).client.getMe());
    expect(e).toMatchObject({ retryable: true, retryAfterSec: 12, code: "rate_limited" });
  });

  it("déballe { pass } sur GET /passes/{id}", async () => {
    const { client } = clientReturning(200, { pass: { passId: "p1", name: "n", passType: "custom", status: "draft" } });
    expect((await client.getPass("p1")).body.pass.passId).toBe("p1");
  });
});
