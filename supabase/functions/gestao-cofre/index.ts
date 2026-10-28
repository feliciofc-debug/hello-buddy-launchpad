import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  decifrarCofreBytes,
  decodeBase64Cofre,
  sha256Hex,
} from "../_shared/gestao-cofre-crypto.ts";
import {
  gestaoTrocaAuthedUser,
  jsonResponse,
  optionsResponse,
} from "../_shared/gestao-troca-http.ts";
import {
  buildCrlvTrocaPatch,
  buildCrlvVehiclePatch,
  CRLV_STOCK_FIELDS,
  CRLV_TROCA_FIELDS,
  safeCrlvReading,
  sanitizeCrlvVehicleValues,
} from "../_shared/crlv-cofre.ts";
import { gestaoCofreUpload } from "../_shared/gestao-cofre-upload.ts";
import {
  assertGestaoDocumentoCamposUpdateOk,
  CAMPOS_VEICULO_PII_KEYS,
  camposVeiculoContainsPiiKey,
  camposVeiculoSemPii,
} from "../_shared/gestao-cofre-campos.ts";

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
const PII_KEYS = new Set<string>(CAMPOS_VEICULO_PII_KEYS);

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
  veiculo_id?: string | null;
  troca_id?: string | null;
  campos_veiculo?: Record<string, unknown>;
};

function adminClient(): Admin {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
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
      "id,user_id,storage_path,mime,tamanho,tipo,status,created_at,deleted_at,veiculo_id,troca_id,campos_veiculo",
    )
    .eq("id", documentoId).eq("user_id", userId).maybeSingle();
  return data && !data.deleted_at ? data as OwnedDocument : null;
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
  const campos = body.campos_veiculo && typeof body.campos_veiculo === "object"
    ? body.campos_veiculo as Record<string, unknown>
    : {};
  if (camposVeiculoContainsPiiKey(campos)) {
    return jsonResponse({
      error: "Dados pessoais devem ser enviados no campo protegido",
    }, 400);
  }
  const result = await gestaoCofreUpload({
    sb,
    userId,
    bytes,
    mime,
    tipo,
    origem: origem as "painel" | "troca" | "whatsapp",
    filename: String(body.filename ?? ""),
    veiculoId: body.veiculo_id ? String(body.veiculo_id) : null,
    trocaId: body.troca_id ? String(body.troca_id) : null,
    vendaId: body.venda_id ? String(body.venda_id) : null,
    camposVeiculo: campos,
    dadosPessoais: body.dados_pessoais &&
        typeof body.dados_pessoais === "object"
      ? body.dados_pessoais as Record<string, unknown>
      : null,
    lerCrlv: tipo === "crlv" || tipo === "crlv_e",
  });
  return jsonResponse({
    success: true,
    documento_id: result.documentoId,
    sha256: result.sha256,
    leitura: result.leitura ? safeCrlvReading(result.leitura) : null,
    leitura_erro: result.leituraErro,
    reaproveitado: result.duplicate,
  });
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

async function documentReading(
  sb: Admin,
  userId: string,
  documentoId: string,
) {
  const doc = await ownedDocument(sb, userId, documentoId);
  if (!doc || !["crlv", "crlv_e"].includes(doc.tipo)) {
    return jsonResponse({ error: "CRLV não encontrado" }, 404);
  }
  const fields = doc.campos_veiculo ?? {};
  const vehicle = fields.veiculo && typeof fields.veiculo === "object"
    ? fields.veiculo as Record<string, unknown>
    : {};
  const coreFound = ["placa", "renavam", "chassi", "marca_modelo_versao"]
    .filter((key) => {
      const field = vehicle[key] as { valor?: unknown } | undefined;
      return field?.valor != null;
    }).length;
  return jsonResponse({
    success: true,
    leitura: {
      veiculo: vehicle,
      documento: fields.documento ?? {},
      observacoes: fields.observacoes ?? {
        texto: { valor: null, confianca: "baixa" },
        alienacao_fiduciaria: { valor: false, confianca: "baixa" },
        financeira: { valor: null, confianca: "baixa" },
        restricoes: { valor: [], confianca: "baixa" },
      },
      proprietario: {
        primeiro_nome: null,
        cpf_cnpj_mascarado: null,
      },
      fonte: doc.mime === "application/pdf" ? "pdf_texto" : "ocr",
      leitura_fraca: coreFound < 3,
    },
  });
}

async function confirmCrlv(
  sb: Admin,
  userId: string,
  body: Record<string, unknown>,
) {
  const documentoId = String(body.documento_id ?? "");
  const doc = await ownedDocument(sb, userId, documentoId);
  if (!doc || !["crlv", "crlv_e"].includes(doc.tipo)) {
    return jsonResponse({ error: "CRLV não encontrado" }, 404);
  }
  const vehicleId = String(body.veiculo_id ?? doc.veiculo_id ?? "") || null;
  const trocaId = String(body.troca_id ?? doc.troca_id ?? "") || null;
  const values = body.valores && typeof body.valores === "object"
    ? body.valores as Record<string, unknown>
    : {};
  if (camposVeiculoContainsPiiKey(values)) {
    return jsonResponse({
      error: "Dados pessoais não podem ser confirmados em campo aberto",
    }, 400);
  }
  const replace = new Set(
    Array.isArray(body.substituir)
      ? body.substituir.map(String).filter((key) => CRLV_STOCK_FIELDS.has(key))
      : [],
  );
  const sanitized = sanitizeCrlvVehicleValues(values);
  const updatedFields: string[] = [];
  if (vehicleId) {
    const select = [...CRLV_STOCK_FIELDS].join(",");
    const { data: vehicle } = await sb.from("veiculos_estoque").select(select)
      .eq("id", vehicleId).eq("user_id", userId).maybeSingle();
    if (!vehicle) return jsonResponse({ error: "Veículo não encontrado" }, 404);
    const patch = buildCrlvVehiclePatch(
      vehicle as unknown as Record<string, unknown>,
      sanitized,
      replace,
    );
    updatedFields.push(...Object.keys(patch));
    if (Object.keys(patch).length) {
      const { error } = await sb.from("veiculos_estoque").update(patch)
        .eq("id", vehicleId).eq("user_id", userId);
      if (error) throw new Error("Falha ao atualizar veículo");
    }
  }
  if (trocaId) {
    const select = [...CRLV_TROCA_FIELDS].join(",");
    const { data: troca } = await sb.from("gestao_troca").select(select)
      .eq("id", trocaId).eq("user_id", userId).maybeSingle();
    if (!troca) return jsonResponse({ error: "Troca não encontrada" }, 404);
    const patch = buildCrlvTrocaPatch(
      troca as unknown as Record<string, unknown>,
      sanitized,
      replace,
    );
    updatedFields.push(...Object.keys(patch));
    if (Object.keys(patch).length) {
      const { error } = await sb.from("gestao_troca").update(patch)
        .eq("id", trocaId).eq("user_id", userId);
      if (error) throw new Error("Falha ao atualizar troca");
    }
  }
  const confirmedFields = camposVeiculoSemPii({
    ...(doc.campos_veiculo ?? {}),
    confirmados: sanitized,
  });
  const { error } = await sb.from("gestao_documento").update({
    veiculo_id: vehicleId,
    troca_id: trocaId,
    status: "confirmado",
    campos_veiculo: confirmedFields,
  }).eq("id", documentoId).eq("user_id", userId);
  assertGestaoDocumentoCamposUpdateOk(error);
  await audit(sb, documentoId, userId, "confirmar", {
    campos_atualizados: updatedFields,
    vinculado: Boolean(vehicleId || trocaId),
  });
  return jsonResponse({ success: true, campos_atualizados: updatedFields });
}

async function linkDocument(
  sb: Admin,
  userId: string,
  documentoId: string,
  vehicleId: string,
) {
  if (!await ownedDocument(sb, userId, documentoId)) {
    return jsonResponse({ error: "Documento não encontrado" }, 404);
  }
  const { data: vehicle } = await sb.from("veiculos_estoque").select("id")
    .eq("id", vehicleId).eq("user_id", userId).maybeSingle();
  if (!vehicle) return jsonResponse({ error: "Veículo não encontrado" }, 404);
  const { error } = await sb.from("gestao_documento").update({
    veiculo_id: vehicleId,
  }).eq("id", documentoId).eq("user_id", userId);
  if (error) throw new Error("Falha ao vincular documento");
  await audit(sb, documentoId, userId, "confirmar", {
    vinculado: true,
    campos_atualizados: [],
  });
  return jsonResponse({ success: true });
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
    if (action === "leitura_documento") {
      return await documentReading(
        sb,
        user.id,
        String(body.documento_id ?? ""),
      );
    }
    if (action === "confirmar_crlv") {
      return await confirmCrlv(sb, user.id, body);
    }
    if (action === "vincular") {
      return await linkDocument(
        sb,
        user.id,
        String(body.documento_id ?? ""),
        String(body.veiculo_id ?? ""),
      );
    }
    return jsonResponse({ error: "Ação inválida" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.warn(
      "[gestao-cofre]",
      message || "erro",
    );
    if (message.includes("DOC_COFRE_KEY não configurada")) {
      return jsonResponse({
        error:
          "O cofre ainda não está configurado. Peça ao administrador para configurar a chave de segurança.",
      }, 503);
    }
    return jsonResponse(
      { error: "Não foi possível processar o documento" },
      400,
    );
  }
});
