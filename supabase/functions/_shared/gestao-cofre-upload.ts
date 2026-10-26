import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  cifrarCofreBytes,
  cifrarDadosPessoais,
  sha256Hex,
} from "./gestao-cofre-crypto.ts";
import { lerCrlvLocal } from "./crlv-leitura.ts";
import type { CrlvOcrMetricas } from "./crlv-leitura.ts";
import {
  type CrlvParserResultado,
  parseCrlvText,
} from "./crlv-parser.ts";

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

export const CRLV_LEITURA_FRACA_MENSAGEM =
  "Não consegui ler esta foto. Tire outra de cima, documento aberto, com boa luz — ou digite a placa e use Completar pela Molicar";

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
  metricasOcr: CrlvOcrMetricas | null;
  duplicate: boolean;
};

async function readCrlv(
  input: GestaoCofreUploadInput,
): Promise<{
  leitura: CrlvParserResultado | null;
  leituraErro: string | null;
  metricasOcr: CrlvOcrMetricas | null;
}> {
  if (
    !input.lerCrlv ||
    (input.tipo !== "crlv" && input.tipo !== "crlv_e")
  ) {
    return { leitura: null, leituraErro: null, metricasOcr: null };
  }
  try {
    const result = await lerCrlvLocal(
      input.bytes,
      input.mime,
      input.filename,
    );
    return {
      leitura: result.parser,
      leituraErro: result.parser.leitura_fraca
        ? CRLV_LEITURA_FRACA_MENSAGEM
        : null,
      metricasOcr: result.metricas_ocr,
    };
  } catch {
    // Falha do OCR não impede o cofre nem a conferência manual.
    return {
      leitura: parseCrlvText("", "ocr"),
      leituraErro: CRLV_LEITURA_FRACA_MENSAGEM,
      metricasOcr: null,
    };
  }
}

export async function gestaoCofreUpload(
  input: GestaoCofreUploadInput,
): Promise<GestaoCofreUploadResult> {
  if (!input.bytes.byteLength || input.bytes.byteLength > MAX_BYTES) {
    throw new Error("Arquivo deve ter até 15 MB");
  }
  if (!ALLOWED_MIME.has(input.mime.toLowerCase())) {
    throw new Error("Tipo de arquivo não permitido");
  }
  if (!ALLOWED_TIPO.has(input.tipo)) {
    throw new Error("Tipo de documento inválido");
  }
  const sha256 = await sha256Hex(input.bytes);
  const { data: duplicate } = await input.sb.from("gestao_documento")
    .select("id").eq("user_id", input.userId).eq("sha256", sha256)
    .is("deleted_at", null).maybeSingle();
  if (duplicate) {
    const reread = await readCrlv(input);
    const patch: Record<string, unknown> = {
      origem: input.origem,
      tipo: input.tipo,
      status: reread.leitura ? "lido" : "recebido",
    };
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
      "ler",
      { ...(reread.metricasOcr ?? {}), reaproveitado: true },
    );
    return {
      documentoId: String(duplicate.id),
      sha256,
      ...reread,
      duplicate: true,
    };
  }

  const campos = input.camposVeiculo ?? {};
  if (containsPiiKey(campos)) {
    throw new Error("Dados pessoais devem ser enviados no campo protegido");
  }

  const { leitura, leituraErro, metricasOcr } = await readCrlv(input);

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
          metricasOcr: null,
          duplicate: true,
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
  }
  return {
    documentoId,
    sha256,
    leitura,
    leituraErro,
    metricasOcr,
    duplicate: false,
  };
}
