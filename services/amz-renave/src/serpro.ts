import https from "node:https";
import {
  RENAVE_OPERATIONS,
  type RenaveEnvironment,
  type RenaveOperation,
  type RenavePathParamKind,
} from "./operations.js";

const BASE_URLS: Record<RenaveEnvironment, string> = {
  hom: "https://hom.renave.estaleiro.serpro.gov.br/renave-ws",
  prod: "https://renave.estaleiro.serpro.gov.br/renave-ws",
};
const TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const DOCUMENT_MAX_RESPONSE_BYTES = 22 * 1024 * 1024;
const DOCUMENT_OPERATIONS = new Set<RenaveOperation>([
  "pdfAtpv",
  "termoEntrada",
  "termoSaida",
  "crlve",
]);

export function responseLimitForOperation(
  operation: RenaveOperation,
): number {
  return DOCUMENT_OPERATIONS.has(operation)
    ? DOCUMENT_MAX_RESPONSE_BYTES
    : DEFAULT_MAX_RESPONSE_BYTES;
}

export type SerproCall = {
  ambiente: RenaveEnvironment;
  operacao: RenaveOperation;
  params: Record<string, unknown>;
  body?: unknown;
  certificate?: {
    pfx: Buffer;
    passphrase: string;
  };
};

export type SerproResponse = {
  status: number;
  body: unknown;
};

function appendQuery(
  url: URL,
  params: Record<string, unknown>,
  allowedParams: readonly string[],
  consumedParams: ReadonlySet<string>,
): string | undefined {
  let cnpjEstabelecimento: string | undefined;
  for (const [key, raw] of Object.entries(params)) {
    if (!allowedParams.includes(key)) {
      throw new Error(`Parâmetro não permitido: ${key}`);
    }
    if (consumedParams.has(key)) continue;
    if (raw == null || raw === "") continue;
    if (key === "cnpjEstabelecimento") {
      cnpjEstabelecimento = String(raw);
      if (!/^\d{14}$/.test(cnpjEstabelecimento)) {
        throw new Error("CNPJ-Estabelecimento inválido");
      }
      continue;
    }
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (!["string", "number", "boolean"].includes(typeof value)) {
        throw new Error(`Parâmetro inválido: ${key}`);
      }
      url.searchParams.append(key, String(value));
    }
  }
  return cnpjEstabelecimento;
}

function normalizePathParam(
  name: string,
  kind: RenavePathParamKind,
  raw: unknown,
): string {
  const value = String(raw ?? "").trim();
  if (kind === "placa" && /^[A-Za-z]{3}[0-9][A-Za-z0-9][0-9]{2}$/.test(value)) {
    return value.toUpperCase();
  }
  if (kind === "renavam" && /^\d{11}$/.test(value)) return value;
  if (
    kind === "idEstoque" &&
    /^\d+$/.test(value) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0
  ) {
    return String(Number(value));
  }
  throw new Error(`Parâmetro de path inválido: ${name}`);
}

export function buildOperationPath(
  template: string,
  params: Record<string, unknown>,
  pathParams: Readonly<Record<string, RenavePathParamKind>> = {},
): { path: string; consumed: Set<string> } {
  let path = template;
  const consumed = new Set<string>();
  for (const [name, kind] of Object.entries(pathParams)) {
    const token = `{${name}}`;
    if (!path.includes(token)) throw new Error(`Path inválido: ${name}`);
    const normalized = normalizePathParam(name, kind, params[name]);
    path = path.replaceAll(token, encodeURIComponent(normalized));
    consumed.add(name);
  }
  if (/\{[^}]+\}/.test(path)) throw new Error("Parâmetro de path ausente");
  return { path, consumed };
}

export function selectSerproResponseBody(
  status: number,
  body: unknown,
): unknown {
  if (status >= 200 && status < 300) return body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const record = body as Record<string, unknown>;
  if (status === 422) {
    return {
      mensagemParaUsuarioFinal: record.mensagemParaUsuarioFinal,
    };
  }
  if (status === 400 || status >= 500) {
    return {
      titulo: record.titulo,
      detalhe: record.detalhe,
      logIdRastreabilidade: record.logIdRastreabilidade,
    };
  }
  return {};
}

export async function callSerpro(input: SerproCall): Promise<SerproResponse> {
  const operation = RENAVE_OPERATIONS[input.operacao];
  const maxResponseBytes = responseLimitForOperation(input.operacao);
  const builtPath = buildOperationPath(
    operation.path,
    input.params,
    "pathParams" in operation ? operation.pathParams : {},
  );
  const url = new URL(`${BASE_URLS[input.ambiente]}${builtPath.path}`);
  const cnpj = appendQuery(
    url,
    input.params,
    operation.params,
    builtPath.consumed,
  );
  const payload = operation.method === "POST"
    ? Buffer.from(JSON.stringify(input.body ?? {}), "utf8")
    : undefined;
  const agent = input.certificate
    ? new https.Agent({
      pfx: input.certificate.pfx,
      passphrase: input.certificate.passphrase,
      keepAlive: false,
      maxSockets: 1,
    })
    : undefined;

  try {
    return await new Promise<SerproResponse>((resolve, reject) => {
      const request = https.request(url, {
        method: operation.method,
        agent,
        headers: {
          Accept: "application/json",
          ...(payload
            ? {
              "Content-Type": "application/json",
              "Content-Length": String(payload.length),
            }
            : {}),
          ...(cnpj ? { "CNPJ-Estabelecimento": cnpj } : {}),
        },
        timeout: TIMEOUT_MS,
      }, (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxResponseBytes) {
            request.destroy(new Error("Resposta do Serpro excedeu o limite"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let body: unknown = raw;
          if (raw) {
            try {
              body = JSON.parse(raw);
            } catch {
              body = { detalhe: "Resposta inválida do Serpro" };
            }
          } else {
            body = null;
          }
          const status = response.statusCode ?? 502;
          resolve({ status, body: selectSerproResponseBody(status, body) });
        });
      });
      request.once("timeout", () => {
        request.destroy(new Error("Serpro excedeu 30 segundos"));
      });
      request.once("error", reject);
      if (payload) request.write(payload);
      request.end();
    });
  } finally {
    agent?.destroy();
    payload?.fill(0);
  }
}
