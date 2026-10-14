import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseWebhookEvent, verifyWebhookSignature } from "../lib/wallet/webhook";

const secret = "whsec_test";
// Forme documentée : passId au niveau racine, identité dans data.
const body = JSON.stringify({
  id: "evt_1789344000123_a1b2c3",
  type: "pass.issued",
  created: 1789344000,
  passId: "pass_1",
  data: { instanceId: "inst_1", platform: "apple", email: "x@exemple.fr", barcodeContent: "…" },
});
const sign = (ts: string, raw: string) => "sha256=" + createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");

describe("signature webhook", () => {
  const now = 1_790_000_000_000;
  const ts = String(now / 1000);

  it("accepte une signature valide", () => {
    expect(verifyWebhookSignature({ secret, rawBody: body, signatureHeader: sign(ts, body), timestampHeader: ts, now })).toEqual({ ok: true });
  });
  it("rejette un corps modifié", () => {
    const r = verifyWebhookSignature({ secret, rawBody: body + " ", signatureHeader: sign(ts, body), timestampHeader: ts, now });
    expect(r).toEqual({ ok: false, reason: "bad_signature" });
  });
  it("rejette un horodatage de plus de 5 minutes", () => {
    const old = String(now / 1000 - 301);
    const r = verifyWebhookSignature({ secret, rawBody: body, signatureHeader: sign(old, body), timestampHeader: old, now });
    expect(r).toEqual({ ok: false, reason: "stale_timestamp" });
  });
  it("rejette sans en-têtes", () => {
    expect(verifyWebhookSignature({ secret, rawBody: body, signatureHeader: null, timestampHeader: ts, now }).ok).toBe(false);
  });
  it("lit l'événement", () => {
    expect(parseWebhookEvent(body, "pass.issued")).toEqual({ id: "evt_1789344000123_a1b2c3", type: "pass.issued", instanceId: "inst_1", passId: "pass_1", platform: "apple" });
  });
});
