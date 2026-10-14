/**
 * Configuration serveur. Ce module lit la clé API : il ne doit JAMAIS être
 * importé depuis un composant client (« use client »).
 */
import { parseFieldKeyMap } from "./fields";

if (typeof window !== "undefined") {
  throw new Error("lib/wallet/config ne doit pas être chargé côté client");
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`);
  return v;
}

export const passStudioConfig = () => ({
  apiKey: required("PASS_STUDIO_API_KEY"),
  fieldKeyMap: parseFieldKeyMap(process.env.PASS_STUDIO_FIELD_KEYS),
  baseUrl: (process.env.PASS_STUDIO_BASE_URL ?? "https://www.passstudio.online/api/v1").replace(/\/$/, ""),
  passId: required("PASS_STUDIO_PASS_ID"),
});

export const webhookSecret = () => required("PASS_STUDIO_WEBHOOK_SECRET");

export const siteUrl = () => (process.env.PUBLIC_SITE_URL ?? "https://rendezvousia.fr").replace(/\/$/, "");

export const pushIntervalMs = () => Number(process.env.WALLET_PUSH_INTERVAL_MS ?? 250);

export const isPassStudioConfigured = () =>
  Boolean(process.env.PASS_STUDIO_API_KEY && process.env.PASS_STUDIO_PASS_ID);
