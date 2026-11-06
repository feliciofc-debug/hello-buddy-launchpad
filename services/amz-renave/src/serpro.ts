import https from "node:https";
import { RENAVE_OPERATIONS, type RenaveEnvironment, type RenaveOperation } from "./operations.js";

const BASE_URLS: Record<RenaveEnvironment, string> = {
  hom: "https://hom.renave.estaleiro.serpro.gov.br/renave-ws",
  prod: "https://renave.estaleiro.serpro.gov.br/renave-ws",
};
const TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

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
): string | undefined {
  let cnpjEstabelecimento: string | undefined;
  for (const [key, raw] of Object.entries(params)) {
    if (!allowedParams.includes(key)) {
      throw new Error(`Parâmetro não permitido: ${key}`);
    }
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

export function selectSerproResponseBody(status: number, body: unknown): unknown {
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
  return body;
}

export async function callSerpro(input: SerproCall): Promise<SerproResponse> {
  const operation = RENAVE_OPERATIONS[input.operacao];
  const url = new URL(`${BASE_URLS[input.ambiente]}${operation.path}`);
  const cnpj = appendQuery(url, input.params, operation.params);
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
          if (size > MAX_RESPONSE_BYTES) {
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
