import type { MolicarToken } from "./molicar-client.ts";
import { MolicarHttpError } from "./molicar-client.ts";

export const MOLICAR_PROCEDENCIA_SERVICES = [
  "debts",
  "gravame",
  "renajud",
] as const;
export type MolicarProcedenciaService =
  typeof MOLICAR_PROCEDENCIA_SERVICES[number];
export type MolicarIdentityType = "plate" | "vin";

type Fetcher = typeof fetch;
type TokenProvider = (forceRefresh: boolean) => Promise<MolicarToken>;

function decoderBase(): string {
  const value = (Deno.env.get("MOLICAR_DECODER_URL") ||
    "https://decoder.molicar.com.br").trim();
  if (
    !/^https:\/\//i.test(value) &&
    !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(value)
  ) throw new Error("MOLICAR_DECODER_URL deve usar HTTPS.");
  return value.replace(/\/+$/, "");
}

export function molicarProcedenciaPath(
  service: MolicarProcedenciaService,
  identityType: MolicarIdentityType,
  identity: string,
  jobId?: string,
): string {
  if (service === "renajud" && identityType !== "plate") {
    throw new Error("Renajud só possui endpoint oficial por placa.");
  }
  if (jobId && identityType === "vin") {
    throw new Error(
      "A Molicar não documenta polling com JobId para consultas por chassi.",
    );
  }
  const suffix = jobId ? `/${encodeURIComponent(jobId)}` : "";
  return `/api/v1/${identityType}/${
    encodeURIComponent(identity)
  }/${service}${suffix}`;
}

async function json(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new MolicarHttpError(res.status, "Resposta inválida da Molicar.");
  }
}

async function providerGet(
  path: string,
  getToken: TokenProvider,
  fetcher: Fetcher,
): Promise<{ status: number; body: unknown }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getToken(attempt === 1);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    let response: Response;
    try {
      response = await fetcher(`${decoderBase()}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new Error("Tempo esgotado ao contactar a Molicar.");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
    const body = await json(response);
    if (response.status === 401 && attempt === 0) continue;
    return { status: response.status, body };
  }
  throw new MolicarHttpError(401, "Credenciais Molicar inválidas.");
}

export async function createMolicarProcedencia(input: {
  service: MolicarProcedenciaService;
  identityType: MolicarIdentityType;
  identity: string;
  getToken: TokenProvider;
  fetcher?: Fetcher;
}) {
  return await providerGet(
    molicarProcedenciaPath(
      input.service,
      input.identityType,
      input.identity,
    ),
    input.getToken,
    input.fetcher ?? fetch,
  );
}

export async function pollMolicarProcedencia(input: {
  service: MolicarProcedenciaService;
  plate: string;
  jobId: string;
  getToken: TokenProvider;
  fetcher?: Fetcher;
}) {
  return await providerGet(
    molicarProcedenciaPath(input.service, "plate", input.plate, input.jobId),
    input.getToken,
    input.fetcher ?? fetch,
  );
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function findCaseInsensitive(
  source: Record<string, unknown>,
  names: string[],
): unknown {
  for (const name of names) {
    const wanted = name.toLowerCase();
    for (const [key, value] of Object.entries(source)) {
      if (key.toLowerCase() === wanted) return value;
    }
  }
  return undefined;
}

export function molicarJobId(payload: unknown): string | null {
  const root = record(payload);
  const direct = findCaseInsensitive(root, ["JobId", "job_id"]);
  if (direct != null && String(direct).trim()) return String(direct).trim();
  for (const key of ["data", "result", "response"]) {
    const nested = molicarJobId(findCaseInsensitive(root, [key]));
    if (nested) return nested;
  }
  return null;
}

export function molicarProviderStatus(payload: unknown): string | null {
  const root = record(payload);
  const raw = findCaseInsensitive(root, [
    "Code",
    "code",
    "statusCode",
    "Status",
  ]);
  if (raw != null) return String(raw).trim().toUpperCase();
  for (const key of ["data", "result", "response"]) {
    const nested = molicarProviderStatus(findCaseInsensitive(root, [key]));
    if (nested) return nested;
  }
  return null;
}

export function classifyMolicarProcedencia(
  httpStatus: number,
  payload: unknown,
): "pending" | "completed" | "error" | "expired" {
  const status = molicarProviderStatus(payload);
  if (httpStatus === 202 || status === "PROCESSING") return "pending";
  if (httpStatus === 410 || status === "REQUEST_EXPIRED") return "expired";
  if (
    [400, 404, 422].includes(httpStatus) ||
    ["INVALID_PARAMETER", "JOB_NOT_FOUND", "UNPROCESSABLE_ENTITY"].includes(
      status ?? "",
    )
  ) return "error";
  if (httpStatus >= 200 && httpStatus < 300) return "completed";
  return "error";
}

export function sanitizeMolicarProcedencia(payload: unknown): unknown {
  const walk = (value: unknown, sensitiveContext = false): unknown => {
    if (Array.isArray(value)) {
      return value.map((item) => walk(item, sensitiveContext));
    }
    if (!value || typeof value !== "object") return value;
    const clean: Record<string, unknown> = {};
    for (
      const [key, child] of Object.entries(value as Record<string, unknown>)
    ) {
      const normalized = key.replace(/[_\s-]/g, "").toLowerCase();
      const agent = normalized === "agent" || normalized.startsWith("agent");
      const owner = /owner|propriet|financed|financiad/.test(normalized);
      const directPii =
        /^(cpf|documento|documentnumber|ownerdocument(number)?|ownername|nomeproprietario|proprietario|proprietarydocumenttype|financedname|financeddocumentnumber|nomefinanciado|telefone|phone|email|endereco|address)$/
          .test(normalized);
      const contextualPii = sensitiveContext &&
        /^(name|nome|document|documento|documentnumber|cpf|cnpj|phone|telefone|email|address|endereco)$/
          .test(normalized);
      if (directPii || contextualPii || (owner && typeof child !== "object")) {
        continue;
      }
      clean[key] = walk(child, agent ? false : sensitiveContext || owner);
    }
    return clean;
  };
  return walk(payload);
}

export function constantTimeSecretEqual(actual: string, expected: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(actual);
  const right = encoder.encode(expected);
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return difference === 0;
}

/** Ensures the three independently documented subscription types for this credential. */
export async function ensureMolicarWebhookSubscriptions(input: {
  getToken: TokenProvider;
  fetcher?: Fetcher;
}): Promise<void> {
  const endpointUrl = (Deno.env.get("MOLICAR_PROCEDENCIA_WEBHOOK_URL") || "")
    .trim();
  const apiKey = (Deno.env.get("MOLICAR_PROCEDENCIA_WEBHOOK_SECRET") || "")
    .trim();
  if (!/^https:\/\//i.test(endpointUrl) || !apiKey) {
    throw new Error(
      "Configure MOLICAR_PROCEDENCIA_WEBHOOK_URL HTTPS e MOLICAR_PROCEDENCIA_WEBHOOK_SECRET.",
    );
  }
  const fetcher = input.fetcher ?? fetch;
  const url = `${decoderBase()}/api/v1/webhook-subscriptions`;
  const request = async (method: "GET" | "POST", body?: unknown) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await input.getToken(attempt === 1);
      const response = await fetcher(url, {
        method,
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const parsed = await json(response);
      if (response.status === 401 && attempt === 0) continue;
      if (!response.ok) {
        throw new MolicarHttpError(
          response.status,
          "Não foi possível registrar o webhook Molicar.",
        );
      }
      return parsed;
    }
    throw new MolicarHttpError(401, "Credenciais Molicar inválidas.");
  };

  for (const service of MOLICAR_PROCEDENCIA_SERVICES) {
    await request("POST", {
      EndpointUrl: endpointUrl,
      SubscriptionType: service,
      AuthConfig: {
        Type: "API_KEY",
        ApiKey: {
          HeaderName: "X-Molicar-Webhook-Key",
          HeaderValue: apiKey,
        },
      },
    });
  }
}
