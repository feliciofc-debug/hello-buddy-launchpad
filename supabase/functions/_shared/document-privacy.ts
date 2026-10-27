import { classificarDocumentoIdentidade } from "./documento-detector.ts";

export const DOCUMENT_AI_GATEWAY_URL =
  "https://ai.gateway.lovable.dev/v1/chat/completions";

export type DocumentExternalAudience = "client" | "gestao";

export type PreparedDocumentText =
  | {
    allowed: true;
    maskedText: string;
    maskedFilename: string;
    maskedContext: string;
  }
  | {
    allowed: false;
    reason: "client_document" | "identity_document" | "empty_after_masking";
  };

const ADDRESS_LINE =
  /^\s*(?:endere[cç]o|logradouro|rua|r\.|avenida|av\.|travessa|tv\.|alameda|rodovia|estrada|pra[cç]a|largo|bairro|complemento)\b/i;

function maskAddressLines(value: string): string {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => ADDRESS_LINE.test(line) ? "[ENDEREÇO]" : line)
    .join("\n");
}

export function maskSensitiveDocumentText(value: string): string {
  let text = maskAddressLines(value);

  text = text
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      "[E-MAIL]",
    )
    .replace(
      /\b(?:CPF\s*\/\s*CNPJ|CPF|CNPJ)\s*[:#-]?\s*[\d./-]{11,22}\b/gi,
      "[CPF/CNPJ]",
    )
    .replace(
      /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,
      "[CNPJ]",
    )
    .replace(
      /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
      "[CPF]",
    )
    .replace(
      /\b(?:RG|REGISTRO\s+GERAL)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./-]{4,20}\b/gi,
      "[RG]",
    )
    .replace(
      /\b(?:CNH|N[ÚU]MERO\s+DE\s+REGISTRO)\s*[:#-]?\s*\d[\d .-]{7,14}\b/gi,
      "[CNH]",
    )
    .replace(
      /\bRENAVAM\s*[:#-]?\s*\d[\d .-]{7,14}\b/gi,
      "[RENAVAM]",
    )
    .replace(
      /\b(?:CHASSI|VIN)\s*[:#-]?\s*[A-HJ-NPR-Z0-9]{11,20}\b/gi,
      "[CHASSI]",
    )
    .replace(/\b[A-HJ-NPR-Z0-9]{17}\b/gi, "[CHASSI]")
    .replace(
      /\b(?:PLACA\s*[:#-]?\s*)?[A-Z]{3}[-\s]?(?:\d[A-Z]\d{2}|\d{4})\b/gi,
      "[PLACA]",
    )
    .replace(
      /(?<!\d)(?:\+?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?9?\d{4}[\s.-]?\d{4}(?!\d)/g,
      "[TELEFONE]",
    )
    .replace(/\b\d{5}-?\d{3}\b/g, "[CEP]");

  return text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasMeaningfulMaskedText(value: string): boolean {
  const withoutMarkers = String(value || "")
    .replace(
      /\[(?:CPF\/CNPJ|CPF|CNPJ|RG|CNH|RENAVAM|CHASSI|PLACA|TELEFONE|E-MAIL|CEP|ENDEREÇO)\]/g,
      " ",
    )
    .replace(/[^\p{L}\p{N}]+/gu, "");
  return withoutMarkers.length > 0;
}

export function prepareDocumentTextForExternalAi(input: {
  audience: DocumentExternalAudience;
  text: string;
  filename?: string;
  context?: string;
}): PreparedDocumentText {
  if (input.audience !== "gestao") {
    return { allowed: false, reason: "client_document" };
  }
  if (classificarDocumentoIdentidade(input.text).documento) {
    return { allowed: false, reason: "identity_document" };
  }

  const maskedText = maskSensitiveDocumentText(input.text);
  if (!hasMeaningfulMaskedText(maskedText)) {
    return { allowed: false, reason: "empty_after_masking" };
  }
  return {
    allowed: true,
    maskedText,
    maskedFilename: maskSensitiveDocumentText(input.filename || "arquivo"),
    maskedContext: maskSensitiveDocumentText(input.context || ""),
  };
}

export type ExternalDocumentCommentResult =
  | {
    sent: false;
    reason: Exclude<
      PreparedDocumentText,
      { allowed: true }
    >["reason"];
  }
  | { sent: true; reply: string; maskedPayload: string };

export async function commentOnLocallyExtractedDocument(input: {
  audience: DocumentExternalAudience;
  text: string;
  filename?: string;
  kind: string;
  context?: string;
  apiKey: string;
  model: string;
  fetchFn?: typeof fetch;
}): Promise<ExternalDocumentCommentResult> {
  const prepared = prepareDocumentTextForExternalAi(input);
  if (!prepared.allowed) {
    return { sent: false, reason: prepared.reason };
  }

  const userContext = prepared.maskedContext
    ? `\n\nContexto enviado junto: "${prepared.maskedContext}"`
    : "";
  const prompt = [
    "O responsável enviou um arquivo pelo WhatsApp para você comentar.",
    "Leia SOMENTE o texto local e previamente mascarado abaixo.",
    "Responda de forma útil, honesta e direta: pontos fortes, riscos, lacunas e sugestões práticas.",
    "Formato WhatsApp, sem tabela ASCII, máximo aproximado de 250 palavras.",
    "Não tente reconstruir dados mascarados e não use ferramentas.",
    userContext,
    `NOME DO ARQUIVO: ${prepared.maskedFilename}`,
    `TIPO: ${input.kind}`,
    "--- CONTEÚDO LOCAL MASCARADO ---",
    prepared.maskedText,
    "--- FIM ---",
  ].filter(Boolean).join("\n");

  const body = {
    model: input.model,
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content:
          "Comente apenas o texto mascarado fornecido. Nunca invente nem tente inferir dados pessoais removidos.",
      },
      { role: "user", content: prompt },
    ],
  };
  const serialized = JSON.stringify(body);
  if (
    /data:[^;,]+;base64,/i.test(serialized) ||
    /"(?:file_data|image_url|inline_data|inlineData)"\s*:/i.test(serialized)
  ) {
    throw new Error("document_binary_payload_blocked");
  }

  const response = await (input.fetchFn ?? fetch)(DOCUMENT_AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: serialized,
  });
  if (!response.ok) {
    throw new Error(`document_comment_http_${response.status}`);
  }
  const payload = await response.json();
  const reply = String(payload?.choices?.[0]?.message?.content || "").trim();
  if (!reply) throw new Error("document_comment_empty");
  return { sent: true, reply, maskedPayload: serialized };
}
