import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  cifrarCofreBytes,
  cifrarDadosPessoais,
  decifrarCofreBytes,
  decodeBase64Cofre,
  sha256Hex,
} from "../_shared/gestao-cofre-crypto.ts";
import {
  gestaoTrocaAuthedUser,
  jsonResponse,
  optionsResponse,
} from "../_shared/gestao-troca-http.ts";

const BUCKET = "gestao-cofre";
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const ALLOWED_TIPO = new Set([
  "crlv",
  "crlv_e",
  "cnh",
  "atpv_e",
  "procuracao",
  "comprovante_endereco",
  "outro",
]);
const PII_KEYS = new Set([
  "proprietario",
  "proprietario_nome",
  "nome",
  "cpf",
  "cnpj",
  "cpf_cnpj",
  "documento_proprietario",
]);

function containsPiiKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsPiiKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) =>
      PII_KEYS.has(key.toLowerCase()) || containsPiiKey(nested),
  );
}

type Admin = ReturnType<typeof createClient>;
type OwnedDocument = {
  id: string;
  user_id: string;
  storage_path: string;
  mime: string;
  tamanho: number;
  tipo: string;
  status: string;
  created_at: string;
  deleted_at: string | null;
};

function adminClient(): Admin {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

function addYears(date: string, years: number): string {
  const value = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  value.setUTCFullYear(value.getUTCFullYear() + years);
  return value.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

function opaqueToken(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(32)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function audit(
  sb: Admin,
  documentoId: string,
  userId: string,
  acao: string,
  detalhe: Record<string, unknown> = {},
) {
  const safe = Object.fromEntries(
    Object.entries(detalhe).filter(([key]) => !PII_KEYS.has(key)),
  );
  const { error } = await sb.from("gestao_documento_acesso").insert({
    documento_id: documentoId,
    user_id: userId,
    ator_id: userId,
    acao,
    detalhe: safe,
  });
  if (error) throw new Error("Falha ao registrar auditoria");
}

async function ownedDocument(sb: Admin, userId: string, documentoId: string) {
  const { data } = await sb.from("gestao_documento")
    .select(
      "id,user_id,storage_path,mime,tamanho,tipo,status,created_at,deleted_at",
    )
    .eq("id", documentoId).eq("user_id", userId).maybeSingle();
  return data && !data.deleted_at ? data as OwnedDocument : null;
}

async function retentionDate(
  sb: Admin,
  userId: string,
  veiculoId: string | null,
): Promise<string> {
  const { data: config } = await sb.from("gestao_documento_config")
    .select("retencao_anos").eq("user_id", userId).maybeSingle();
  const years = Math.max(1, Math.min(10, Number(config?.retencao_anos ?? 5)));
  if (veiculoId) {
    const { data: sale } = await sb.from("veiculo_venda").select("data_venda")
      .eq("user_id", userId).eq("veiculo_id", veiculoId).maybeSingle();
    if (sale?.data_venda) return addYears(String(sale.data_venda), years);
  }
  return addYears(today(), years);
}

async function upload(
  sb: Admin,
  userId: string,
  body: Record<string, unknown>,
) {
  const mime = String(body.mime ?? "").toLowerCase();
  const tipo = String(body.tipo ?? "");
  const origem = String(body.origem ?? "painel");
  if (!ALLOWED_MIME.has(mime)) {
    return jsonResponse({ error: "Tipo de arquivo não permitido" }, 400);
  }
  if (!ALLOWED_TIPO.has(tipo)) {
    return jsonResponse({ error: "Tipo de documento inválido" }, 400);
  }
  if (!["painel", "troca", "whatsapp"].includes(origem)) {
    return jsonResponse({ error: "Origem inválida" }, 400);
  }
  const bytes = decodeBase64Cofre(String(body.base64 ?? ""));
  if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) {
    return jsonResponse({ error: "Arquivo deve ter até 15 MB" }, 400);
  }
  const sha256 = await sha256Hex(bytes);
  const { data: duplicate } = await sb.from("gestao_documento").select("id")
    .eq("user_id", userId).eq("sha256", sha256).is("deleted_at", null)
    .maybeSingle();
  if (duplicate) {
    return jsonResponse({
      error: "Documento já enviado",
      documento_id: duplicate.id,
    }, 409);
  }

  const campos = body.campos_veiculo && typeof body.campos_veiculo === "object"
    ? body.campos_veiculo as Record<string, unknown>
    : {};
  if (containsPiiKey(campos)) {
    return jsonResponse({
      error: "Dados pessoais devem ser enviados no campo protegido",
    }, 400);
  }
  const pessoais =
    body.dados_pessoais && typeof body.dados_pessoais === "object"
      ? await cifrarDadosPessoais(
        body.dados_pessoais as Record<string, unknown>,
      )
      : null;
  const encrypted = await cifrarCofreBytes(bytes);
  const documentoId = crypto.randomUUID();
  const path = `${userId}/documentos/${documentoId}.cofre`;
  const uploaded = await sb.storage.from(BUCKET).upload(path, encrypted, {
    contentType: "application/octet-stream",
    upsert: false,
  });
  if (uploaded.error) throw new Error("Falha ao armazenar documento");

  const veiculoId = body.veiculo_id ? String(body.veiculo_id) : null;
  const row = {
    id: documentoId,
    user_id: userId,
    veiculo_id: veiculoId,
    troca_id: body.troca_id ? String(body.troca_id) : null,
    venda_id: body.venda_id ? String(body.venda_id) : null,
    tipo,
    origem,
    storage_path: path,
    mime,
    tamanho: bytes.byteLength,
    sha256,
    cifrado: true,
    status: "recebido",
    campos_veiculo: campos,
    dados_pessoais_cifrados: pessoais,
    retencao_ate: await retentionDate(sb, userId, veiculoId),
    created_by: userId,
  };
  const inserted = await sb.from("gestao_documento").insert(row);
  if (inserted.error) {
    await sb.storage.from(BUCKET).remove([path]);
    if (inserted.error.code === "23505") {
      return jsonResponse({ error: "Documento já enviado" }, 409);
    }
    throw new Error("Falha ao registrar documento");
  }
  await audit(sb, documentoId, userId, "upload", {
    origem,
    tipo,
    tamanho: bytes.byteLength,
  });
  return jsonResponse({ success: true, documento_id: documentoId, sha256 });
}

async function list(sb: Admin, userId: string, body: Record<string, unknown>) {
  let query = sb.from("gestao_documento")
    .select(
      "id,veiculo_id,troca_id,venda_id,tipo,origem,mime,tamanho,status,retencao_ate,created_at",
    )
    .eq("user_id", userId).is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (body.veiculo_id) query = query.eq("veiculo_id", String(body.veiculo_id));
  if (body.troca_id) query = query.eq("troca_id", String(body.troca_id));
  const { data, error } = await query;
  if (error) throw new Error("Falha ao listar documentos");
  return jsonResponse({ success: true, documentos: data ?? [] });
}

async function createViewToken(
  sb: Admin,
  userId: string,
  documentoId: string,
) {
  const doc = await ownedDocument(sb, userId, documentoId);
  if (!doc) return jsonResponse({ error: "Documento não encontrado" }, 404);
  const token = opaqueToken();
  const tokenHash = await sha256Hex(new TextEncoder().encode(token));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await sb.from("gestao_documento_token").insert({
    token_hash: tokenHash,
    documento_id: documentoId,
    user_id: userId,
    expires_at: expiresAt,
  });
  if (error) throw new Error("Falha ao criar acesso temporário");
  await audit(sb, documentoId, userId, "ver", { expires_at: expiresAt });
  return jsonResponse({ success: true, token, expires_at: expiresAt });
}

async function openToken(sb: Admin, userId: string, token: string) {
  const tokenHash = await sha256Hex(new TextEncoder().encode(token));
  const { data: access } = await sb.from("gestao_documento_token")
    .select("documento_id,expires_at,used_at").eq("token_hash", tokenHash)
    .eq("user_id", userId).maybeSingle();
  if (
    !access || access.used_at ||
    Date.parse(String(access.expires_at)) <= Date.now()
  ) return jsonResponse({ error: "Acesso expirado ou já utilizado" }, 410);

  const consumed = await sb.from("gestao_documento_token")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", tokenHash).is("used_at", null)
    .select("documento_id").maybeSingle();
  if (consumed.error || !consumed.data) {
    return jsonResponse({ error: "Acesso já utilizado" }, 410);
  }
  const doc = await ownedDocument(sb, userId, String(access.documento_id));
  if (!doc) return jsonResponse({ error: "Documento não encontrado" }, 404);
  const downloaded = await sb.storage.from(BUCKET).download(doc.storage_path);
  if (downloaded.error || !downloaded.data) {
    throw new Error("Falha ao abrir documento");
  }
  const encrypted = new Uint8Array(await downloaded.data.arrayBuffer());
  const plain = await decifrarCofreBytes(encrypted);
  await audit(sb, doc.id, userId, "abrir", {
    tamanho: doc.tamanho,
    mime: doc.mime,
  });
  return jsonResponse({
    success: true,
    mime: doc.mime,
    tamanho: doc.tamanho,
    base64: bytesToBase64(plain),
  });
}

async function remove(sb: Admin, userId: string, documentoId: string) {
  const doc = await ownedDocument(sb, userId, documentoId);
  if (!doc) return jsonResponse({ error: "Documento não encontrado" }, 404);
  const removed = await sb.storage.from(BUCKET).remove([doc.storage_path]);
  if (removed.error) throw new Error("Falha ao excluir arquivo");
  const { error } = await sb.from("gestao_documento").update({
    deleted_at: new Date().toISOString(),
    status: "descartado",
  }).eq("id", documentoId).eq("user_id", userId);
  if (error) throw new Error("Falha ao excluir documento");
  await audit(sb, documentoId, userId, "excluir");
  return jsonResponse({ success: true });
}

async function history(sb: Admin, userId: string, documentoId: string) {
  if (!await ownedDocument(sb, userId, documentoId)) {
    return jsonResponse({ error: "Documento não encontrado" }, 404);
  }
  const { data, error } = await sb.from("gestao_documento_acesso")
    .select("id,acao,detalhe,created_at").eq("documento_id", documentoId)
    .eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error("Falha ao carregar histórico");
  return jsonResponse({ success: true, historico: data ?? [] });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  try {
    const { user } = await gestaoTrocaAuthedUser(req);
    if (!user) return jsonResponse({ error: "Não autenticado" }, 401);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const sb = adminClient();
    if (action === "upload") return await upload(sb, user.id, body);
    if (action === "listar") return await list(sb, user.id, body);
    if (action === "ver") {
      return await createViewToken(
        sb,
        user.id,
        String(body.documento_id ?? ""),
      );
    }
    if (action === "abrir") {
      return await openToken(sb, user.id, String(body.token ?? ""));
    }
    if (action === "excluir") {
      return await remove(sb, user.id, String(body.documento_id ?? ""));
    }
    if (action === "historico") {
      return await history(sb, user.id, String(body.documento_id ?? ""));
    }
    return jsonResponse({ error: "Ação inválida" }, 400);
  } catch (error) {
    console.warn(
      "[gestao-cofre]",
      error instanceof Error ? error.message : "erro",
    );
    return jsonResponse(
      { error: "Não foi possível processar o documento" },
      400,
    );
  }
});
