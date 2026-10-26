import { safeCrlvReading } from "./crlv-cofre.ts";
import { detectarDocumentoLocal } from "./crlv-leitura.ts";
import type { CrlvParserResultado } from "./crlv-parser.ts";
import { decodeBase64Cofre } from "./gestao-cofre-crypto.ts";
import type { MediaExtract } from "./whatsapp-media.ts";
import { extractDocumentText } from "./document-extract.ts";
import { classificarDocumentoIdentidade } from "./documento-detector.ts";

export type DocumentoPortaoResultado = {
  media: MediaExtract;
  bytes: Uint8Array;
  documento: boolean;
  tipo: "crlv" | "cnh" | "rg" | "outro" | null;
};

export function isDocumentoGateCandidate(media: MediaExtract): boolean {
  return media.kind === "image" ||
    (media.kind === "document" &&
      (media.mime === "application/pdf" || media.mime.startsWith("image/")));
}

export async function verificarDocumentoNoPortao(
  media: MediaExtract,
  detector = detectarDocumentoLocal,
  extractor = extractDocumentText,
): Promise<DocumentoPortaoResultado> {
  const bytes = decodeBase64Cofre(media.base64);
  if (
    media.mime === "application/pdf" ||
    media.filename?.toLowerCase().endsWith(".pdf")
  ) {
    try {
      const extracted = await extractor(
        media.base64,
        media.mime,
        media.filename,
      );
      if (extracted.text.trim()) {
        return {
          media,
          bytes,
          ...classificarDocumentoIdentidade(extracted.text),
        };
      }
    } catch {
      // PDF sem texto útil segue para /detectar, que renderiza só a 1ª página.
    }
  }
  const result = await detector(bytes, media.mime);
  return { media, bytes, ...result };
}

export function tipoDocumentoCofre(
  tipo: DocumentoPortaoResultado["tipo"],
  mime: string,
): "crlv" | "crlv_e" | "cnh" | "outro" {
  if (tipo === "crlv") return mime === "application/pdf" ? "crlv_e" : "crlv";
  if (tipo === "cnh") return "cnh";
  return "outro";
}

function ending(value: unknown, length: number): string {
  const clean = String(value ?? "").replace(/\W/g, "");
  return clean ? clean.slice(-length) : "não lido";
}

export function respostaCrlvWhatsApp(parser: CrlvParserResultado): string {
  const safe = safeCrlvReading(parser);
  const vehicle = parser.veiculo;
  const model = vehicle.marca_modelo_versao.valor || "veículo não identificado";
  const year = vehicle.ano_modelo.valor || vehicle.ano_fabricacao.valor ||
    "ano não lido";
  const owner = safe.proprietario.primeiro_nome || "não identificado";
  const ownerDocument = safe.proprietario.cpf_cnpj_mascarado
    ? ` (${safe.proprietario.cpf_cnpj_mascarado})`
    : "";
  const lines = [
    `📄 Li o documento: ${
      vehicle.placa.valor || "placa não lida"
    } · ${model} · ${year} · chassi final ${
      ending(vehicle.chassi.valor, 4)
    } · renavam final ${ending(vehicle.renavam.valor, 3)}.`,
    `Proprietário: ${owner}${ownerDocument}.`,
  ];
  if (parser.observacoes.alienacao_fiduciaria.valor) {
    lines.push(
      `⚠️ Alienação fiduciária${
        parser.observacoes.financeira.valor
          ? `: ${parser.observacoes.financeira.valor}`
          : ""
      }`,
    );
  }
  for (const restriction of parser.observacoes.restricoes.valor ?? []) {
    lines.push(`⚠️ Restrição: ${restriction}`);
  }
  return lines.join("\n");
}

export const DOCUMENTO_CLIENTE_RESPOSTA =
  "Recebi seu documento, vou repassar para a equipe com segurança.";

export const DOCUMENTO_DETECTOR_INDISPONIVEL =
  "Não consegui verificar a imagem agora, tente de novo em instantes.";
