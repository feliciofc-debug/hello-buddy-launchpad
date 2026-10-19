const API_BASE = "https://api.consultarplaca.com.br/v2";

const FORBIDDEN_PATH = /\b(proprietario|fipe)\b/i;

export const CONSULTAR_PLACA_TESTE = "AAA0000";

/** Custo estimado dos 5 serviços pagos + placa básica (painel). */
export const PROCEDENCIA_CUSTO_ESTIMADO_BRL = 38.8;

export type ConsultarPlacaCredentials = {
  email: string;
  apiKey: string;
};

export type ConsultarPlacaCallResult = {
  ok: boolean;
  httpStatus: number;
  endpoint: string;
  tipoErro: string | null;
  payload: Record<string, unknown> | null;
  indisponivel: boolean;
};

function basicAuthHeader(creds: ConsultarPlacaCredentials): string {
  const token = btoa(`${creds.email}:${creds.apiKey}`);
  return `Basic ${token}`;
}

function normalizePlacaApi(placa: string): string {
  return String(placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidBrazilPlaca(placa: string): boolean {
  const p = normalizePlacaApi(placa);
  if (p === CONSULTAR_PLACA_TESTE) return true;
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p) || /^[A-Z]{3}[0-9]{4}$/.test(p);
}

function assertAllowedPath(path: string): void {
  if (FORBIDDEN_PATH.test(path)) {
    throw new Error("Endpoint não permitido");
  }
}

export async function consultarPlacaGet(
  creds: ConsultarPlacaCredentials,
  path: string,
  placa?: string,
  timeoutMs = 310_000,
): Promise<ConsultarPlacaCallResult> {
  assertAllowedPath(path);
  const endpoint = path.startsWith("/") ? path : `/${path}`;
  const qs = placa ? `?placa=${encodeURIComponent(normalizePlacaApi(placa))}` : "";
  const url = `${API_BASE}${endpoint}${qs}`;
  let httpStatus = 0;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: basicAuthHeader(creds),
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    httpStatus = res.status;
    let payload: Record<string, unknown> | null = null;
    try {
      payload = await res.json() as Record<string, unknown>;
    } catch {
      payload = null;
    }
    const status = String(payload?.status ?? "").toLowerCase();
    const tipoErro = payload?.tipo_do_erro != null
      ? String(payload.tipo_do_erro)
      : null;
    const indisponivel = tipoErro === "servico_indisponivel" ||
      status === "indisponivel";
    const ok = res.ok && status !== "erro" && !indisponivel;
    return { ok, httpStatus, endpoint: endpoint + qs, tipoErro, payload, indisponivel };
  } catch (e) {
    const msg = (e as Error).message ?? "fetch_failed";
    return {
      ok: false,
      httpStatus: httpStatus || 0,
      endpoint: endpoint + qs,
      tipoErro: msg.includes("timeout") ? "timeout" : "rede",
      payload: null,
      indisponivel: false,
    };
  }
}

export async function consultarPlacaSaldo(
  creds: ConsultarPlacaCredentials,
): Promise<{ ok: boolean; saldo: number | null; tipoErro: string | null; httpStatus: number }> {
  const r = await consultarPlacaGet(creds, "/consultarSaldo", undefined, 60_000);
  const saldoRaw = r.payload?.saldo ?? r.payload?.credito ?? r.payload?.creditos;
  const saldo = saldoRaw != null ? Number(saldoRaw) : null;
  return {
    ok: r.ok && saldo != null && Number.isFinite(saldo),
    saldo: saldo != null && Number.isFinite(saldo) ? saldo : null,
    tipoErro: r.tipoErro,
    httpStatus: r.httpStatus,
  };
}

export const PROCEDENCIA_ENDPOINTS = [
  "consultarRegistroLeilaoPrime",
  "consultarSinistroComPerdaTotal",
  "consultarHistoricoRouboFurto",
  "consultarGravame",
  "consultarRenajud",
  "consultarPlaca",
] as const;

export async function consultarPlacaPacoteCompleto(
  creds: ConsultarPlacaCredentials,
  placa: string,
): Promise<Record<string, ConsultarPlacaCallResult>> {
  const p = normalizePlacaApi(placa);
  const timeout = p === CONSULTAR_PLACA_TESTE ? 60_000 : 310_000;
  const settled = await Promise.allSettled(
    PROCEDENCIA_ENDPOINTS.map(async (ep) => {
      const r = await consultarPlacaGet(creds, `/${ep}`, p, timeout);
      return { ep, r };
    }),
  );
  const out: Record<string, ConsultarPlacaCallResult> = {};
  for (const s of settled) {
    if (s.status === "fulfilled") {
      out[s.value.ep] = s.value.r;
    } else {
      out.unknown = {
        ok: false,
        httpStatus: 0,
        endpoint: "unknown",
        tipoErro: "rede",
        payload: null,
        indisponivel: false,
      };
    }
  }
  return out;
}
