import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { inspectECnpjPfx } from "./certificate.js";
import type { RenaveConfig } from "./config.js";
import { isRenaveOperation, RENAVE_OPERATIONS, type RenaveEnvironment } from "./operations.js";
import { logRenaveRequest } from "./redaction.js";
import {
  buildOperationPath,
  callSerpro,
  type SerproCall,
  type SerproResponse,
} from "./serpro.js";

const MAX_BODY_BYTES = 20 * 1024 * 1024;

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = Buffer.from(JSON.stringify(body), "utf8");
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": payload.length,
    "Cache-Control": "no-store",
  });
  response.end(payload);
}

function tokenMatches(received: string | undefined, expected: string): boolean {
  const actualHash = createHash("sha256").update(received ?? "").digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  try {
    return Boolean(received) && timingSafeEqual(actualHash, expectedHash);
  } finally {
    actualHash.fill(0);
    expectedHash.fill(0);
  }
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const raw of request) {
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "Corpo excede 20 MB");
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  try {
    const parsed = JSON.parse(bytes.toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("objeto esperado");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "JSON inválido");
  } finally {
    bytes.fill(0);
    for (const chunk of chunks) chunk.fill(0);
  }
}

function requiredString(
  body: Record<string, unknown>,
  key: string,
  maxLength: number,
): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new HttpError(400, `${key} inválido`);
  }
  return value;
}

function decodePfx(value: string): Buffer {
  if (
    value.length > MAX_BODY_BYTES ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    throw new HttpError(400, "pfxBase64 inválido");
  }
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.toString("base64") !== value) {
    bytes.fill(0);
    throw new HttpError(400, "pfxBase64 inválido");
  }
  return bytes;
}

function paramsFrom(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "params inválido");
  }
  return value as Record<string, unknown>;
}

function validateParams(
  value: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  const params = paramsFrom(value);
  for (const [key, raw] of Object.entries(params)) {
    if (!allowed.includes(key)) {
      throw new HttpError(400, `Parâmetro não permitido: ${key}`);
    }
    const values = Array.isArray(raw) ? raw : [raw];
    if (
      values.some((item) =>
        item != null &&
        !["string", "number", "boolean"].includes(typeof item)
      )
    ) {
      throw new HttpError(400, `Parâmetro inválido: ${key}`);
    }
  }
  const cnpj = params.cnpjEstabelecimento;
  if (cnpj != null && !/^\d{14}$/.test(String(cnpj))) {
    throw new HttpError(400, "CNPJ-Estabelecimento inválido");
  }
  return params;
}

type Dependencies = {
  callSerpro: (input: SerproCall) => Promise<SerproResponse>;
};

export function createRenaveServer(
  config: RenaveConfig,
  dependencies: Dependencies = { callSerpro },
): Server {
  return createServer(async (request, response) => {
    const requestId = randomUUID();
    const path = new URL(request.url ?? "/", "http://localhost").pathname;

    if (request.method === "GET" && path === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    const tokenHeader = request.headers["x-renave-token"];
    const token = Array.isArray(tokenHeader) ? undefined : tokenHeader;
    if (!tokenMatches(token, config.token)) {
      sendJson(response, 401, { erro: "Não autorizado" });
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 404, { erro: "Rota não encontrada" });
      return;
    }

    try {
      const body = await readJson(request);
      if (path === "/certificados/selar") {
        const pfx = decodePfx(requiredString(body, "pfxBase64", MAX_BODY_BYTES));
        const senha = requiredString(body, "senha", 1024);
        const lojaId = requiredString(body, "lojaId", 200);
        const senhaBytes = Buffer.from(senha, "utf8");
        try {
          let metadata: ReturnType<typeof inspectECnpjPfx>;
          try {
            metadata = inspectECnpjPfx(pfx, senha);
          } catch (error) {
            throw new HttpError(
              400,
              error instanceof Error ? error.message : "PFX inválido",
            );
          }
          const sealed = config.keyring.seal({
            pfx,
            senha: senhaBytes,
            lojaId,
            cnpj: metadata.cnpj,
          });
          sendJson(response, 200, {
            selado: sealed.selado,
            cnpj: metadata.cnpj,
            validoAte: metadata.validoAte,
            fingerprint: metadata.fingerprint,
            keyVersion: sealed.keyVersion,
          });
        } finally {
          pfx.fill(0);
          senhaBytes.fill(0);
        }
        return;
      }

      if (path !== "/renave/chamar") {
        throw new HttpError(404, "Rota não encontrada");
      }

      const started = performance.now();
      const operacaoValue = body.operacao;
      const ambienteValue = body.ambiente;
      const lojaId = typeof body.lojaId === "string" &&
          /^[A-Za-z0-9_-]{1,100}$/.test(body.lojaId)
        ? body.lojaId
        : undefined;
      let loggedStatus = 500;
      try {
        if (!isRenaveOperation(operacaoValue)) {
          throw new HttpError(400, "Operação não permitida");
        }
        if (ambienteValue !== "hom" && ambienteValue !== "prod") {
          throw new HttpError(400, "ambiente inválido");
        }
        const ambiente: RenaveEnvironment = ambienteValue;
        const operation = RENAVE_OPERATIONS[operacaoValue];
        if ("homOnly" in operation && ambiente === "prod") {
          throw new HttpError(400, "Operação disponível somente em homologação");
        }
        if (ambiente === "prod" && !config.prodEnabled) {
          throw new HttpError(403, "Produção RENAVE desabilitada");
        }

        let opened: ReturnType<RenaveConfig["keyring"]["open"]> | undefined;
        try {
          if (ambiente === "prod") {
            const selado = requiredString(body, "selado", MAX_BODY_BYTES);
            const requiredLojaId = requiredString(body, "lojaId", 200);
            try {
              opened = config.keyring.open(selado, requiredLojaId);
            } catch {
              throw new HttpError(400, "Certificado selado inválido");
            }
          }
          let result: SerproResponse;
          try {
            const validatedParams = validateParams(
              body.params,
              operation.params,
            );
            try {
              buildOperationPath(
                operation.path,
                validatedParams,
                "pathParams" in operation ? operation.pathParams : {},
              );
            } catch (error) {
              throw new HttpError(
                400,
                error instanceof Error ? error.message : "Path inválido",
              );
            }
            result = await dependencies.callSerpro({
              ambiente,
              operacao: operacaoValue,
              params: validatedParams,
              ...(body.body !== undefined ? { body: body.body } : {}),
              ...(opened
                ? {
                  certificate: {
                    pfx: opened.pfx,
                    passphrase: opened.senha.toString("utf8"),
                  },
                }
                : {}),
            });
          } catch (error) {
            if (error instanceof HttpError) throw error;
            throw new HttpError(502, "Serpro indisponível");
          }
          loggedStatus = result.status;
          sendJson(response, 200, result);
        } finally {
          opened?.pfx.fill(0);
          opened?.senha.fill(0);
        }
      } catch (error) {
        if (error instanceof HttpError) loggedStatus = error.status;
        throw error;
      } finally {
        logRenaveRequest({
          requestId,
          operacao: isRenaveOperation(operacaoValue) ? operacaoValue : "invalida",
          ambiente: ambienteValue === "hom" || ambienteValue === "prod"
            ? ambienteValue
            : "invalido",
          status: loggedStatus,
          duracaoMs: Math.round(performance.now() - started),
          ...(lojaId ? { lojaId } : {}),
        });
      }
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof Error && status < 500
        ? error.message
        : "Falha interna";
      if (!response.headersSent) sendJson(response, status, { erro: message });
    }
  });
}
