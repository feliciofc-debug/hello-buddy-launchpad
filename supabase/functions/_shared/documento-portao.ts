import { maskOwnerDocument } from "./crlv-cofre.ts";
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
  possivel_documento: boolean;
  tipo: "crlv" | "cnh" | "rg" | "outro" | null;
};

export function deveBloquearDocumentoParceiro(
  resultado: Pick<DocumentoPortaoResultado, "documento" | "possivel_documento">,
): boolean {
  return resultado.documento;
}

export function isDocumentoGateCandidate(media: MediaExtract): boolean {
  return media.kind === "image" ||
    (media.kind === "document" &&
      (media.mime === "application/pdf" || media.mime.startsWith("image/")));
}

export function markProtectedDocumentMedia<T extends MediaExtract>(
  media: T,
): T {
  media.protected_document = true;
  return media;
}

export function isProtectedDocumentMedia(
  media: MediaExtract | null | undefined,
): boolean {
  return media?.protected_document === true;
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
        const classification = classificarDocumentoIdentidade(extracted.text);
        if (classification.documento) markProtectedDocumentMedia(media);
        return {
          media,
          bytes,
          ...classification,
          possivel_documento: false,
        };
      }
    } catch {
      // PDF sem texto útil segue para /detectar, que renderiza só a 1ª página.
    }
  }
  const result = await detector(bytes, media.mime);
  if (result.documento || result.possivel_documento) {
    markProtectedDocumentMedia(media);
  }
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

export function respostaCrlvWhatsApp(parser: CrlvParserResultado): string {
  const vehicle = parser.veiculo;
  const read = (value: unknown) =>
    value == null || String(value).trim() === "" ? "não lido" : String(value);
  const ownerDocument = maskOwnerDocument(
    parser.proprietario.cpf_cnpj.valor,
  ) ?? "não lido";
  const lines = [
    "✅ CRLV lido e guardado na plataforma.",
    `Placa: ${read(vehicle.placa.valor)}`,
    `Renavam: ${read(vehicle.renavam.valor)}`,
    `Chassi: ${read(vehicle.chassi.valor)}`,
    `Marca/modelo/versão: ${read(vehicle.marca_modelo_versao.valor)}`,
    `Ano fabricação/modelo: ${read(vehicle.ano_fabricacao.valor)}/${
      read(vehicle.ano_modelo.valor)
    }`,
    `Cor: ${read(vehicle.cor.valor)}`,
    `Combustível: ${read(vehicle.combustivel.valor)}`,
    `Categoria: ${read(vehicle.categoria.valor)}`,
    `Município/UF: ${read(parser.documento.municipio.valor)}/${
      read(parser.documento.uf.valor)
    }`,
    `Proprietário: ${read(parser.proprietario.nome.valor)}`,
    `CPF/CNPJ: ${ownerDocument}`,
  ];
  return lines.join("\n");
}

export const DOCUMENTO_CLIENTE_RESPOSTA =
  "Recebi seu documento, vou repassar para a equipe com segurança.";

export const DOCUMENTO_DETECTOR_INDISPONIVEL =
  "Não consegui verificar a imagem agora, tente de novo em instantes.";
