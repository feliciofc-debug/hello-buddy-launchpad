export type GestaoFocusAmbiente = "homolog" | "producao";

export function focusNfeApiBase(ambiente: GestaoFocusAmbiente): string {
  return ambiente === "producao"
    ? "https://api.focusnfe.com.br/v2"
    : "https://homologacao.focusnfe.com.br/v2";
}

export function focusNfeBasicAuthHeader(token: string): string {
  const basic = btoa(`${token}:`);
  return `Basic ${basic}`;
}

export async function focusNfeFetch(
  ambiente: GestaoFocusAmbiente,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${focusNfeApiBase(ambiente)}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: focusNfeBasicAuthHeader(token),
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

export async function focusNfeTestConnection(
  ambiente: GestaoFocusAmbiente,
  token: string,
): Promise<{ ok: boolean; message: string }> {
  const res = await focusNfeFetch(ambiente, token, "/empresas", { method: "GET" });
  if (res.status === 401 || res.status === 403) {
    return { ok: false, message: "Token inválido ou sem permissão na Focus NFe." };
  }
  if (!res.ok) {
    return { ok: false, message: "Não foi possível validar a conexão com a Focus NFe." };
  }
  return { ok: true, message: "Conexão OK." };
}

export type FocusNfeConsulta = {
  status?: string;
  status_sefaz?: string;
  mensagem_sefaz?: string;
  chave_nfe?: string;
  numero?: string | number;
  serie?: string | number;
  caminho_danfe?: string;
  caminho_xml_nota_fiscal?: string;
};

export function focusNfeAbsoluteUrl(
  ambiente: GestaoFocusAmbiente,
  path: string | null | undefined,
): string | null {
  if (!path?.trim()) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const host = ambiente === "producao"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";
  return `${host}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function focusNfeConsultar(
  ambiente: GestaoFocusAmbiente,
  token: string,
  ref: string,
): Promise<FocusNfeConsulta> {
  const res = await focusNfeFetch(ambiente, token, `/nfe/${encodeURIComponent(ref)}`, {
    method: "GET",
  });
  const txt = await res.text();
  let data: FocusNfeConsulta = {};
  try {
    data = JSON.parse(txt);
  } catch {
    throw new Error("Resposta inválida da Focus NFe.");
  }
  if (!res.ok) {
    throw new Error(String((data as { mensagem?: string }).mensagem ?? "Consulta NF-e falhou."));
  }
  return data;
}

export async function focusNfeEmitir(
  ambiente: GestaoFocusAmbiente,
  token: string,
  ref: string,
  payload: Record<string, unknown>,
): Promise<FocusNfeConsulta> {
  const res = await focusNfeFetch(
    ambiente,
    token,
    `/nfe?ref=${encodeURIComponent(ref)}`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  const txt = await res.text();
  let data: FocusNfeConsulta = {};
  try {
    data = JSON.parse(txt);
  } catch {
    throw new Error("Resposta inválida ao emitir NF-e.");
  }
  if (!res.ok && res.status !== 202) {
    const msg = String((data as { mensagem?: string }).mensagem ?? txt.slice(0, 200));
    throw new Error(msg || "Emissão NF-e recusada pela Focus.");
  }
  return data;
}

export async function focusNfeCancelar(
  ambiente: GestaoFocusAmbiente,
  token: string,
  ref: string,
  justificativa: string,
): Promise<FocusNfeConsulta> {
  const res = await focusNfeFetch(
    ambiente,
    token,
    `/nfe/${encodeURIComponent(ref)}`,
    {
      method: "DELETE",
      body: JSON.stringify({ justificativa: justificativa.slice(0, 255) }),
    },
  );
  const txt = await res.text();
  let data: FocusNfeConsulta = {};
  try {
    data = JSON.parse(txt);
  } catch {
    throw new Error("Resposta inválida ao cancelar NF-e.");
  }
  if (!res.ok) {
    throw new Error(String((data as { mensagem?: string }).mensagem ?? "Cancelamento falhou."));
  }
  return data;
}

export async function focusNfeCartaCorrecao(
  ambiente: GestaoFocusAmbiente,
  token: string,
  ref: string,
  correcao: string,
): Promise<FocusNfeConsulta> {
  const res = await focusNfeFetch(
    ambiente,
    token,
    `/nfe/${encodeURIComponent(ref)}/carta_correcao`,
    {
      method: "POST",
      body: JSON.stringify({ correcao: correcao.slice(0, 1000) }),
    },
  );
  const txt = await res.text();
  let data: FocusNfeConsulta = {};
  try {
    data = JSON.parse(txt);
  } catch {
    throw new Error("Resposta inválida na carta de correção.");
  }
  if (!res.ok) {
    throw new Error(String((data as { mensagem?: string }).mensagem ?? "Carta de correção falhou."));
  }
  return data;
}

export function mapFocusStatusToGestao(status: string | undefined): string {
  const s = String(status ?? "").toLowerCase();
  if (s === "autorizado") return "autorizada";
  if (s === "cancelado") return "cancelada";
  if (s === "processando_autorizacao") return "processando";
  if (s === "erro_autorizacao") return "rejeitada";
  if (s) return "processando";
  return "processando";
}
