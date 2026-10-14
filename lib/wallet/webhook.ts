import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;

export type WebhookVerification =
  | { ok: true }
  | { ok: false; reason: "missing_headers" | "bad_signature" | "stale_timestamp" };

/** La doc donne des secondes Unix ; les millisecondes sont tolérées par prudence. */
function timestampToMs(ts: string): number {
  const n = Number(ts);
  if (!Number.isFinite(n)) return NaN;
  return n < 1e12 ? n * 1000 : n;
}

/**
 * Vérifie X-PassStudio-Signature = "sha256=" + HMAC-SHA256(secret, timestamp + "." + rawBody)
 * sur le CORPS BRUT, en temps constant, et refuse un horodatage de plus de 5 minutes.
 */
export function verifyWebhookSignature(params: {
  secret: string;
  rawBody: string;
  signatureHeader: string | null;
  timestampHeader: string | null;
  now?: number;
}): WebhookVerification {
  const { secret, rawBody, signatureHeader, timestampHeader } = params;
  if (!signatureHeader || !timestampHeader) return { ok: false, reason: "missing_headers" };

  const tsMs = timestampToMs(timestampHeader);
  const now = params.now ?? Date.now();
  if (!Number.isFinite(tsMs) || Math.abs(now - tsMs) > MAX_WEBHOOK_AGE_MS) {
    return { ok: false, reason: "stale_timestamp" };
  }

  const provided = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : signatureHeader;
  const expected = createHmac("sha256", secret).update(`${timestampHeader}.${rawBody}`).digest("hex");
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "bad_signature" };
  return { ok: true };
}

export interface ParsedWebhookEvent {
  id: string | null;
  type: string;
  instanceId: string | null;
  passId: string | null;
  platform: "apple" | "google" | null;
}

/**
 * Corps documenté : { id, type, created, passId, data: { instanceId, platform, email, … } }.
 * `data` contient des données personnelles : on n'en garde que le nécessaire.
 */
export function parseWebhookEvent(rawBody: string, eventHeader: string | null): ParsedWebhookEvent {
  const json = JSON.parse(rawBody);
  const data = json.data ?? {};
  const platformRaw = String(data.platform ?? "").toLowerCase();
  return {
    id: json.id ?? null,
    type: eventHeader ?? json.type ?? json.event ?? "unknown",
    instanceId: data.instanceId ?? null,
    passId: json.passId ?? data.passId ?? null,
    platform: platformRaw.includes("apple") ? "apple" : platformRaw.includes("google") ? "google" : null,
  };
}
