import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  cifrarCofreBytes,
  cifrarDadosPessoais,
  decifrarDadosPessoais,
  sha256Hex,
} from "./gestao-cofre-crypto.ts";
import { lerCrlvLocal } from "./crlv-leitura.ts";
import type { CrlvOcrMetricas } from "./crlv-leitura.ts";
import type { CrlvParserResultado } from "./crlv-parser.ts";

const BUCKET = "gestao-cofre";
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/xml",
  "application/octet-stream",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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

export const CRLV_NAO_LIDO_MENSAGEM =
  "Não consegui ler este documento. Tire outra foto reta, de cima, com boa luz e sem reflexo.";
export const CRLV_LEITURA_FRACA_MENSAGEM = CRLV_NAO_LIDO_MENSAGEM;

export type CrlvLeituraReason =
  | "ocr_unreadable"
  | "ocr_timeout"
  | "ocr_not_configured"
  | "ocr_failed";

type CofreClient = SupabaseClient<any, "public", any>;

function containsPiiKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsPiiKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) =>
      PII_KEYS.has(key.toLowerCase()) || containsPiiKey(nested),
  );
}

function addYears(date: string, years: number): string {
  const value = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  value.setUTCFullYear(value.getUTCFullYear() + years);
  return value.toISOString().slice(0, 10);
}

async function retentionDate(
  sb: CofreClient,
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
  return addYears(new Date().toISOString().slice(0, 10), years);
}

export async function auditGestaoDocumento(
  sb: CofreClient,
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

export type GestaoCofreUploadInput = {
  sb: CofreClient;
  userId: string;
  bytes: Uint8Array;
  mime: string;
  tipo: string;
  origem: "painel" | "troca" | "whatsapp";
  filename?: string;
  veiculoId?: string | null;
  trocaId?: string | null;
  vendaId?: string | null;
  camposVeiculo?: Record<string, unknown>;
  dadosPessoais?: Record<string, unknown> | null;
  lerCrlv?: boolean;
};

export type GestaoCofreUploadResult = {
  documentoId: string;
  sha256: string;
  leitura: CrlvParserResultado | null;
  leituraErro: string | null;
  leituraReason: CrlvLeituraReason | null;
  metricasOcr: CrlvOcrMetricas | null;
  duplicate: boolean;
  reusedSuccessfulRead: boolean;
};

function crlvFailureReason(error: unknown): CrlvLeituraReason {
  const message = String((error as Error)?.message ?? "");
  if (
    (error as Error)?.name === "TimeoutError" ||
    /tempo esgotado|timeout|timed out|abort/i.test(message)
  ) return "ocr_timeout";
  if (/n[aã]o configurado|ausente/i.test(message)) return "ocr_not_configured";
  return "ocr_failed";
}

async function previousSuccessfulReading(
  duplicate: Record<string, unknown>,
): Promise<CrlvParserResultado | null> {
  if (duplicate.status !== "lido") return null;
  const stored = duplicate.campos_veiculo;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return null;
  }
  const sections = stored as Record<string, unknown>;
  const veiculo = sections.veiculo;
  const documento = sections.documento;
  const observacoes = sections.observacoes;
  if (
    !veiculo || typeof veiculo !== "object" || Array.isArray(veiculo) ||
    !documento || typeof documento !== "object" || Array.isArray(documento) ||
    !observacoes || typeof observacoes !== "object" ||
    Array.isArray(observacoes)
  ) return null;
  const vehicleFields = veiculo as CrlvParserResultado["veiculo"];
  const core = [
    vehicleFields.placa,
    vehicleFields.renavam,
    vehicleFields.chassi,
    vehicleFields.marca_modelo_versao,
    vehicleFields.ano_modelo,
  ];
  if (core.filter((field) => field?.valor != null).length < 3) return null;
  let pessoais: Record<string, unknown> = {};
  if (typeof duplicate.dados_pessoais_cifrados === "string") {
    try {
      pessoais = await decifrarDadosPessoais(
        duplicate.dados_pessoais_cifrados,
      );
    } catch {
      return null;
    }
  }
  const personalField = (value: unknown) => ({
    valor: typeof value === "string" && value.trim() ? value : null,
    confianca: "media" as const,
  });
  return {
    veiculo: vehicleFields,
    documento: documento as CrlvParserResultado["documento"],
    proprietario: {
      nome: personalField(pessoais.nome),
      cpf_cnpj: personalField(pessoais.cpf_cnpj),
    },
    observacoes: observacoes as CrlvParserResultado["observacoes"],
    fonte: "ocr",
    leitura_fraca: false,
  };
}

async function readCrlv(
  input: GestaoCofreUploadInput,
  fetchImpl: typeof fetch = fetch,
): Promise<{
  leitura: CrlvParserResultado | null;
  leituraErro: string | null;
  leituraReason: CrlvLeituraReason | null;
  metricasOcr: CrlvOcrMetricas | null;
}> {
  if (
    !input.lerCrlv ||
    (input.tipo !== "crlv" && input.tipo !== "crlv_e")
  ) {
    return {
      leitura: null,
      leituraErro: null,
      leituraReason: null,
      metricasOcr: null,
    };
  }
  try {
    const result = await lerCrlvLocal(
      input.bytes,
      input.mime,
      input.filename,
      fetchImpl,
    );
    return {
      leitura: result.parser,
      leituraErro: null,
      leituraReason: null,
      metricasOcr: result.metricas_ocr,
    };
  } catch (error) {
    // Falha do OCR não impede o cofre nem a conferência manual.
    return {
      leitura: null,
      leituraErro: CRLV_NAO_LIDO_MENSAGEM,
      leituraReason: crlvFailureReason(error),
      metricasOcr: null,
    };
  }
}

export async function relerCrlvDocumentoCofre(input: {
  sb: CofreClient;
  userId: string;
  documentoId: string;
  bytes: Uint8Array;
  mime: string;
  filename?: string;
  fetchImpl?: typeof fetch;
}): Promise<
  Pick<
    GestaoCofreUploadResult,
    "leitura" | "leituraErro" | "leituraReason" | "metricasOcr"
  >
> {
  const result = await readCrlv({
    sb: input.sb,
    userId: input.userId,
    bytes: input.bytes,
    mime: input.mime,
    tipo: input.mime.toLowerCase() === "application/pdf" ? "crlv_e" : "crlv",
    origem: "whatsapp",
    filename: input.filename,
    lerCrlv: true,
  }, input.fetchImpl);
  if (!result.leitura) {
    await auditGestaoDocumento(
      input.sb,
      input.documentoId,
      input.userId,
      "ler_falha",
      {
        reason: result.leituraReason ?? "ocr_failed",
        ...(result.metricasOcr ?? {}),
      },
    );
    return result;
  }
  const { error } = await input.sb.from("gestao_documento").update({
    tipo: input.mime.toLowerCase() === "application/pdf" ? "crlv_e" : "crlv",
    status: "lido",
    campos_veiculo: {
      veiculo: result.leitura.veiculo,
      documento: result.leitura.documento,
      observacoes: result.leitura.observacoes,
    },
    dados_pessoais_cifrados: await cifrarDadosPessoais({
      nome: result.leitura.proprietario.nome.valor,
      cpf_cnpj: result.leitura.proprietario.cpf_cnpj.valor,
    }),
  }).eq("id", input.documentoId).eq("user_id", input.userId);
  if (error) throw new Error("Falha ao registrar leitura do CRLV");
  await auditGestaoDocumento(
    input.sb,
    input.documentoId,
    input.userId,
    "ler",
    result.metricasOcr ?? {},
  );
  return result;
}

export async function gestaoCofreUpload(
  input: GestaoCofreUploadInput,
): Promise<GestaoCofreUploadResult> {
  if (!input.bytes.byteLength || input.bytes.byteLength > MAX_BYTES) {
    throw new Error("Arquivo deve ter até 15 MB");
  }
  const normalizedMime = input.mime.toLowerCase();
  if (
    !ALLOWED_MIME.has(normalizedMime) &&
    !normalizedMime.startsWith("text/")
  ) {
    throw new Error("Tipo de arquivo não permitido");
  }
  if (!ALLOWED_TIPO.has(input.tipo)) {
    throw new Error("Tipo de documento inválido");
  }
  const sha256 = await sha256Hex(input.bytes);
  const { data: duplicate } = await input.sb.from("gestao_documento")
    .select("id,tipo,status,campos_veiculo,dados_pessoais_cifrados")
    .eq("user_id", input.userId).eq("sha256", sha256)
    .is("deleted_at", null).maybeSingle();
  if (duplicate) {
    const previous = await previousSuccessfulReading(
      duplicate as Record<string, unknown>,
    );
    const reread = previous
      ? {
        leitura: previous,
        leituraErro: null,
        leituraReason: null,
        metricasOcr: null,
      }
      : await readCrlv(input);
    const patch: Record<string, unknown> = {
      origem: input.origem,
      status: reread.leitura ? "lido" : (duplicate.status || "recebido"),
    };
    if (reread.leitura) patch.tipo = input.tipo;
    if (input.veiculoId) patch.veiculo_id = input.veiculoId;
    if (input.trocaId) patch.troca_id = input.trocaId;
    if (input.vendaId) patch.venda_id = input.vendaId;
    if (reread.leitura) {
      patch.campos_veiculo = {
        veiculo: reread.leitura.veiculo,
        documento: reread.leitura.documento,
        observacoes: reread.leitura.observacoes,
      };
      patch.dados_pessoais_cifrados = await cifrarDadosPessoais({
        nome: reread.leitura.proprietario.nome.valor,
        cpf_cnpj: reread.leitura.proprietario.cpf_cnpj.valor,
      });
    }
    const { error } = await input.sb.from("gestao_documento").update(patch)
      .eq("id", duplicate.id).eq("user_id", input.userId);
    if (error) throw new Error("Falha ao reaproveitar documento");
    await auditGestaoDocumento(
      input.sb,
      String(duplicate.id),
      input.userId,
      reread.leitura ? "ler" : "ler_falha",
      {
        ...(reread.metricasOcr ?? {}),
        ...(reread.leituraReason ? { reason: reread.leituraReason } : {}),
        reaproveitado: true,
        releitura: !previous,
      },
    );
    return {
      documentoId: String(duplicate.id),
      sha256,
      ...reread,
      duplicate: true,
      reusedSuccessfulRead: Boolean(previous),
    };
  }

  const campos = input.camposVeiculo ?? {};
  if (containsPiiKey(campos)) {
    throw new Error("Dados pessoais devem ser enviados no campo protegido");
  }

  const { leitura, leituraErro, leituraReason, metricasOcr } = await readCrlv(
    input,
  );

  const camposLidos = leitura
    ? {
      veiculo: leitura.veiculo,
      documento: leitura.documento,
      observacoes: leitura.observacoes,
    }
    : campos;
  const pessoaisLidos = leitura
    ? {
      nome: leitura.proprietario.nome.valor,
      cpf_cnpj: leitura.proprietario.cpf_cnpj.valor,
    }
    : input.dadosPessoais;
  const pessoais = pessoaisLidos
    ? await cifrarDadosPessoais(pessoaisLidos)
    : null;
  const encrypted = await cifrarCofreBytes(input.bytes);
  const documentoId = crypto.randomUUID();
  const path = `${input.userId}/documentos/${documentoId}.cofre`;
  const uploaded = await input.sb.storage.from(BUCKET).upload(path, encrypted, {
    contentType: "application/octet-stream",
    upsert: false,
  });
  if (uploaded.error) throw new Error("Falha ao armazenar documento");

  const veiculoId = input.veiculoId ?? null;
  const inserted = await input.sb.from("gestao_documento").insert({
    id: documentoId,
    user_id: input.userId,
    veiculo_id: veiculoId,
    troca_id: input.trocaId ?? null,
    venda_id: input.vendaId ?? null,
    tipo: input.tipo,
    origem: input.origem,
    storage_path: path,
    mime: input.mime,
    tamanho: input.bytes.byteLength,
    sha256,
    cifrado: true,
    status: leitura ? "lido" : "recebido",
    campos_veiculo: camposLidos,
    dados_pessoais_cifrados: pessoais,
    retencao_ate: await retentionDate(input.sb, input.userId, veiculoId),
    created_by: input.userId,
  });
  if (inserted.error) {
    await input.sb.storage.from(BUCKET).remove([path]);
    if (inserted.error.code === "23505") {
      const { data } = await input.sb.from("gestao_documento").select("id")
        .eq("user_id", input.userId).eq("sha256", sha256)
        .is("deleted_at", null).maybeSingle();
      if (data?.id) {
        return {
          documentoId: String(data.id),
          sha256,
          leitura: null,
          leituraErro: null,
          leituraReason: null,
          metricasOcr: null,
          duplicate: true,
          reusedSuccessfulRead: false,
        };
      }
    }
    throw new Error("Falha ao registrar documento");
  }
  await auditGestaoDocumento(
    input.sb,
    documentoId,
    input.userId,
    "upload",
    {
      origem: input.origem,
      tipo: input.tipo,
      tamanho: input.bytes.byteLength,
    },
  );
  if (leitura) {
    await auditGestaoDocumento(
      input.sb,
      documentoId,
      input.userId,
      "ler",
      metricasOcr ?? {},
    );
  } else if (leituraReason) {
    await auditGestaoDocumento(
      input.sb,
      documentoId,
      input.userId,
      "ler_falha",
      { reason: leituraReason, ...(metricasOcr ?? {}) },
    );
  }
  return {
    documentoId,
    sha256,
    leitura,
    leituraErro,
    leituraReason,
    metricasOcr,
    duplicate: false,
    reusedSuccessfulRead: false,
  };
}
