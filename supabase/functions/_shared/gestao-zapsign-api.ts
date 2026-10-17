export type GestaoZapsignAmbiente = "sandbox" | "producao";

export function zapsignApiBase(ambiente: GestaoZapsignAmbiente): string {
  return ambiente === "producao"
    ? "https://api.zapsign.com.br"
    : "https://sandbox.api.zapsign.com.br";
}

export type ZapsignSignerInput = {
  name: string;
  email?: string;
  phone_country?: string;
  phone_number?: string;
  send_automatic_email?: boolean;
  send_automatic_whatsapp?: boolean;
};

export type ZapsignCreateDocInput = {
  name: string;
  base64_pdf: string;
  sandbox: boolean;
  external_id?: string;
  signers: ZapsignSignerInput[];
};

export type ZapsignCreateDocResponse = {
  token?: string;
  status?: string;
  signers?: Array<{ sign_url?: string; token?: string; email?: string }>;
};

export async function zapsignFetch(
  ambiente: GestaoZapsignAmbiente,
  apiToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${zapsignApiBase(ambiente)}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export async function zapsignTestConnection(
  ambiente: GestaoZapsignAmbiente,
  apiToken: string,
): Promise<{ ok: boolean; message: string }> {
  const res = await zapsignFetch(ambiente, apiToken, "/api/v1/docs/?page=1", { method: "GET" });
  if (res.status === 401 || res.status === 403) {
    return { ok: false, message: "Token inválido ou sem permissão." };
  }
  if (!res.ok) {
    return { ok: false, message: "Não foi possível validar a conexão com a ZapSign." };
  }
  return { ok: true, message: "Conexão OK." };
}

export async function zapsignCreateDocFromPdf(
  ambiente: GestaoZapsignAmbiente,
  apiToken: string,
  input: ZapsignCreateDocInput,
): Promise<ZapsignCreateDocResponse> {
  const res = await zapsignFetch(ambiente, apiToken, "/api/v1/docs/", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.detail === "string" ? data.detail : "Falha ao criar documento na ZapSign.";
    throw new Error(msg);
  }
  return data as ZapsignCreateDocResponse;
}

export async function zapsignCancelDoc(
  ambiente: GestaoZapsignAmbiente,
  apiToken: string,
  docToken: string,
): Promise<void> {
  const res = await zapsignFetch(ambiente, apiToken, `/api/v1/docs/${docToken}/`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error("Não foi possível cancelar o documento na ZapSign.");
  }
}

export function mapZapsignWebhookStatus(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("signed") || s.includes("assinado") || s === "finished") return "assinado";
  if (s.includes("cancel") || s.includes("deleted")) return "cancelado";
  if (s.includes("refused") || s.includes("recusado")) return "recusado";
  return "pendente_assinatura";
}
