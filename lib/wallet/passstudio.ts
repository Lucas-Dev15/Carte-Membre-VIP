/**
 * Client HTTP The Pass Studio — SERVEUR UNIQUEMENT.
 *
 * Tous les appels à l'API passent par ce fichier. Les chemins et noms de champs
 * viennent de la spécification interne (docs/SPEC_CARTE_MEMBRE_WALLET.md) ;
 * ceux marqués « À VÉRIFIER » n'ont pas pu être confrontés à
 * https://www.thepassstudio.com/docs/integrations au moment de l'écriture.
 */
import type { PassFields, PassLocation } from "./fields";

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

export class PassStudioError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    readonly retryable: boolean,
    readonly requestId: string | null,
    message: string,
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
  barcodeType: string;
  showBarcodeText: boolean;
  backWebsiteUrl: string;
  holderPhotoStrip: null;
  originalLanguage: string;
}

export interface CreatePassInput {
  name: string;
  passType: "loyalty" | "custom";
  distributionMode: "unique";
  status?: "draft" | "active";
  design: PassDesign;
  fields?: unknown; // structure à aligner sur la doc (À VÉRIFIER)
}

export interface PassInfo {
  id: string;
  status: string;
  fieldKeys?: string[];
  templateOwnedFieldKeys?: string[];
  publishBlockers?: unknown[];
  [k: string]: unknown;
}

export interface IssueInput {
  customerId: string;
  source: string;
  email: string;
  name: string;
  sendEmail: boolean;
  includeArtifacts: boolean;
  locale: string;
  barcodeValue: string;
  fields: PassFields;
  locations?: PassLocation[]; // À VÉRIFIER : accepté à l'émission ?
}

export interface IssueResult {
  instanceId: string;
  alreadyExisted?: boolean;
  barcodeContent?: string;
  addToWalletUrl?: string;
  artifacts?: { appleWalletUrl?: string; googleWalletUrl?: string };
  [k: string]: unknown;
}

export interface UpdateFieldsInput {
  instanceId: string;
  fields: Partial<PassFields>;
  message?: string;
  locations?: PassLocation[] | null;
  externalRef: string;
}

export interface UpdateFieldsResult {
  pushSkipReason?: string;
  [k: string]: unknown;
}

export class PassStudioClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: PassStudioClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
    const started = Date.now();
    const res = await this.fetchImpl(`${this.opts.baseUrl}${path}`, {
      method,
      headers: {
        // À VÉRIFIER : schéma d'authentification exact (Bearer supposé).
        Authorization: `Bearer ${this.opts.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const requestId = res.headers.get("x-request-id");
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    const errorCode: string | null = json?.code ?? json?.error?.code ?? null;
    // Journal sans jamais inclure la clé ni le corps (données personnelles).
    this.opts.logger?.({ method, path, status: res.status, requestId, errorCode, durationMs: Date.now() - started });

    if (res.status >= 400) {
      const retryable = Boolean(json?.retryable ?? json?.error?.retryable ?? res.status >= 500);
      const message = json?.message ?? json?.error?.message ?? `HTTP ${res.status}`;
      throw new PassStudioError(res.status, errorCode, retryable, requestId, message);
    }
    return { status: res.status, requestId, body: (json?.data ?? json) as T };
  }

  createPass(input: CreatePassInput) {
    return this.request<PassInfo>("POST", "/passes", input);
  }

  getPass(passId: string) {
    return this.request<PassInfo>("GET", `/passes/${encodeURIComponent(passId)}`);
  }

  /** À VÉRIFIER : la doc peut exposer un endpoint de publication dédié. */
  updatePass(passId: string, patch: Partial<CreatePassInput> & Record<string, unknown>) {
    return this.request<PassInfo>("PATCH", `/passes/${encodeURIComponent(passId)}`, patch);
  }

  issue(passId: string, input: IssueInput) {
    return this.request<IssueResult>("POST", `/passes/${encodeURIComponent(passId)}/issue`, input);
  }

  updateFields(input: UpdateFieldsInput) {
    return this.request<UpdateFieldsResult>("PATCH", "/instances/fields", input);
  }

  revoke(instanceId: string, reason?: string) {
    return this.request<unknown>("POST", "/instances/revoke", { instanceId, reason });
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
