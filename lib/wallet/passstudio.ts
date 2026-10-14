/**
 * Client HTTP The Pass Studio — SERVEUR UNIQUEMENT.
 *
 * Tous les appels à l'API passent par ce fichier.
 * Référence : https://www.thepassstudio.com/docs/integrations (+ errors, rate-limits, billing).
 */
import type { PassLocation } from "./fields";

export interface PassStudioClientOptions {
  apiKey: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
  logger?: (entry: ApiLogEntry) => void;
}

export interface ApiLogEntry {
  method: string;
  path: string;
  status: number;
  requestId: string | null;
  errorCode: string | null;
  durationMs: number;
}

/** Erreur API : `{ error, code, requestId, retryable? }` (doc « API error codes »). */
export class PassStudioError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    readonly retryable: boolean,
    readonly requestId: string | null,
    message: string,
    /** Secondes à attendre (en-tête Retry-After, sur un 429). */
    readonly retryAfterSec: number | null = null,
  ) {
    super(message);
    this.name = "PassStudioError";
  }
}

export interface ApiResult<T> {
  status: number;
  requestId: string | null;
  body: T;
}

export interface PassDesign {
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
  organizationName: string;
  description: string;
  logoUrl: string;
  iconUrl: string;
  stripImageUrl: string;
  barcodeType?: string;
  showBarcodeText: boolean;
  backWebsiteUrl: string;
  holderPhotoStrip: null;
  originalLanguage: "fr";
}

export interface CreatePassInput {
  name: string;
  passType: "loyalty" | "custom";
  distributionMode: "unique";
  status?: "draft" | "active";
  sendInviteEmail?: boolean;
  clientRequestId?: string;
  design: PassDesign;
}

export interface PassInfo {
  passId: string;
  name: string;
  passType: string;
  status: string;
  distributionMode?: string;
  sendInviteEmail?: boolean;
  fieldKeys?: string[];
  fieldLabels?: Record<string, string>;
  templateOwnedFieldKeys?: string[];
  design?: Record<string, unknown>;
  [k: string]: unknown;
}

/** Réponse de POST /passes et PATCH /passes/{id} : `{ pass, published?, publishBlockers?, … }`. */
export interface PassWriteResult {
  pass: PassInfo;
  published?: boolean;
  publishSkipReason?: string;
  publishBlockers?: unknown[];
  alreadyExisted?: boolean;
  [k: string]: unknown;
}

export interface IssueInput {
  customerId: string;
  source: string;
  email?: string;
  name: string;
  sendEmail: boolean;
  includeArtifacts: boolean;
  locale: string;
  barcodeValue: string;
  /** Clés RÉELLES du pass (voir fieldKeyMap), pas nos clés logiques. */
  fields: Record<string, string>;
  locations?: PassLocation[];
}

export interface IssueResult {
  instanceId: string;
  alreadyExisted?: boolean;
  barcodeContent?: string;
  addToWalletUrl?: string;
  platform?: string | null;
  artifacts?: { appleWalletUrl?: string; googleWalletUrl?: string };
  [k: string]: unknown;
}

export interface UpdateFieldsInput {
  instanceId: string;
  fields: Record<string, string>;
  message?: string;
  /** 1 à 10 lieux propres au porteur, ou null pour revenir aux lieux du modèle. */
  locations?: PassLocation[] | null;
  externalRef: string;
}

export interface UpdateFieldsResult {
  ok?: boolean;
  pushed?: boolean;
  pushSkipReason?: "no_change" | "insufficient_credits" | string;
  alreadyProcessed?: boolean;
  warnings?: unknown[];
  [k: string]: unknown;
}

export interface MeResult {
  id: string;
  billing?: { credits: number; plan: string };
  [k: string]: unknown;
}

export class PassStudioClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: PassStudioClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async request<T>(method: string, path: string, body?: unknown, requestId?: string): Promise<ApiResult<T>> {
    const started = Date.now();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.opts.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    // Notre propre id (≤ 64 caractères : lettres, chiffres, . _ -), renvoyé par l'API.
    if (requestId) headers["X-Request-Id"] = requestId.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 64);

    const res = await this.fetchImpl(`${this.opts.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const resRequestId = res.headers.get("x-request-id");
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    const errorCode: string | null = res.status >= 400 ? (json?.code ?? null) : null;
    // Journal sans jamais inclure la clé ni le corps (données personnelles).
    this.opts.logger?.({
      method,
      path,
      status: res.status,
      requestId: resRequestId ?? json?.requestId ?? null,
      errorCode,
      durationMs: Date.now() - started,
    });

    if (res.status >= 400) {
      const retryAfter = Number(res.headers.get("retry-after"));
      // Doc : un 500 n'est réessayable que s'il porte retryable: true. 429 : réessayer après Retry-After.
      // Une passerelle (502/503/504) sans corps JSON est traitée comme transitoire.
      const retryable =
        json?.retryable === true || res.status === 429 || (json === null && [502, 503, 504].includes(res.status));
      throw new PassStudioError(
        res.status,
        errorCode,
        retryable,
        resRequestId ?? json?.requestId ?? null,
        typeof json?.error === "string" ? json.error : `HTTP ${res.status}`,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
      );
    }
    return { status: res.status, requestId: resRequestId, body: json as T };
  }

  getMe() {
    return this.request<MeResult>("GET", "/me");
  }

  createPass(input: CreatePassInput) {
    return this.request<PassWriteResult>("POST", "/passes", input);
  }

  getPass(passId: string, locale = "fr") {
    return this.request<{ pass: PassInfo }>("GET", `/passes/${encodeURIComponent(passId)}?locale=${locale}`);
  }

  updatePass(passId: string, patch: Record<string, unknown>) {
    return this.request<PassWriteResult>("PATCH", `/passes/${encodeURIComponent(passId)}`, patch);
  }

  /** Valeurs communes à tous les porteurs (clés du modèle, ex. howTo). 1 crédit par push. */
  updateTemplateFields(passId: string, fields: Record<string, string>) {
    return this.request<UpdateFieldsResult>("PATCH", `/passes/${encodeURIComponent(passId)}/fields`, { fields });
  }

  issue(passId: string, input: IssueInput, requestId?: string) {
    return this.request<IssueResult>("POST", `/passes/${encodeURIComponent(passId)}/issue`, input, requestId);
  }

  updateFields(input: UpdateFieldsInput) {
    return this.request<UpdateFieldsResult>("PATCH", "/instances/fields", input, input.externalRef);
  }

  revoke(instanceId: string, reason?: string) {
    return this.request<{ ok: boolean; instanceId: string; alreadyRevoked?: boolean }>("POST", "/instances/revoke", {
      instanceId,
      reason,
    });
  }
}

let singleton: PassStudioClient | null = null;

export async function getPassStudioClient(): Promise<PassStudioClient> {
  if (!singleton) {
    const { passStudioConfig } = await import("./config");
    const cfg = passStudioConfig();
    singleton = new PassStudioClient({
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl,
      logger: (e) => console.info("[passstudio]", JSON.stringify(e)),
    });
  }
  return singleton;
}
