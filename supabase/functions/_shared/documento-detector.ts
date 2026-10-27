import { validarRenavam } from "./crlv-parser.ts";

export type DocumentoIdentidadeTipo = "crlv" | "cnh" | "rg" | "outro" | null;

function normalize(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .trim();
}

function cpfValid(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(value[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(value[9]) && digit(10) === Number(value[10]);
}

function cnpjValid(value: string): boolean {
  if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;
  const calc = (length: number, weights: number[]) => {
    const sum = weights.reduce(
      (total, weight, index) => total + Number(value[index]) * weight,
      0,
    );
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) ===
      Number(value[12]) &&
    calc(13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) ===
      Number(value[13]);
}

function hasValidPattern(text: string): boolean {
  const digitRuns = text.match(/\b[\d./-]{11,18}\b/g) ?? [];
  for (const raw of digitRuns) {
    const digits = raw.replace(/\D/g, "");
    if (cpfValid(digits) || cnpjValid(digits) || validarRenavam(digits)) {
      return true;
    }
  }
  return /\b[A-HJ-NPR-Z0-9]{17}\b/.test(text);
}

export function classificarDocumentoIdentidade(
  rawText: string,
): { documento: boolean; tipo: DocumentoIdentidadeTipo } {
  const text = normalize(rawText);
  if (
    text.includes("CERTIFICADO DE REGISTRO E LICENCIAMENTO") ||
    text.includes("CERTIFICADO DE REGISTRO DE VEICULO")
  ) return { documento: true, tipo: "crlv" };
  if (
    text.includes("CARTEIRA NACIONAL DE HABILITACAO") ||
    text.includes("PERMISSAO PARA DIRIGIR")
  ) return { documento: true, tipo: "cnh" };
  if (
    text.includes("CARTEIRA DE IDENTIDADE") ||
    text.includes("CEDULA DE IDENTIDADE")
  ) return { documento: true, tipo: "rg" };
  if (
    text.includes("AUTORIZACAO PARA TRANSFERENCIA DE PROPRIEDADE") ||
    /\bATPV-E\b/.test(text) ||
    (/\bPROCURACAO\b/.test(text) &&
      /\b(VEICULO|AUTOMOTOR|DETRAN|TRANSFERENCIA)\b/.test(text))
  ) return { documento: true, tipo: "outro" };

  const officialHeader = text.includes("REPUBLICA FEDERATIVA DO BRASIL");
  const authority = /\b(DETRAN|SENATRAN|MINISTERIO|SECRETARIA DE SEGURANCA)\b/
    .test(text);
  if (officialHeader && authority && hasValidPattern(text)) {
    const tipo = text.includes("RENAVAM") || text.includes("LICENCIAMENTO")
      ? "crlv"
      : text.includes("HABILITACAO")
      ? "cnh"
      : text.includes("REGISTRO GERAL")
      ? "rg"
      : "outro";
    return { documento: true, tipo };
  }
  return { documento: false, tipo: null };
}

export function classificarTextoDocumentoProtegido(
  rawText: string,
): { documento: boolean; tipo: DocumentoIdentidadeTipo } {
  const identity = classificarDocumentoIdentidade(rawText);
  if (identity.documento) return identity;

  const text = normalize(rawText);
  const formattedCpfs = text.match(/\b\d{3}[.\s]\d{3}[.\s]\d{3}[-\s]\d{2}\b/g) ??
    [];
  const labelledCpf = text.match(/\bCPF\b[^\d]{0,12}[\d.\s-]{11,20}/g) ?? [];
  if (
    [...formattedCpfs, ...labelledCpf].some((value) =>
      cpfValid(value.replace(/\D/g, "").slice(-11))
    )
  ) {
    return { documento: true, tipo: "outro" };
  }

  const rg = text.match(
    /\b(?:RG|REGISTRO GERAL)\b[^\dX]{0,12}([0-9X][0-9X.\s-]{5,15})/,
  )?.[1];
  const rgDigits = rg?.replace(/[^0-9X]/g, "") ?? "";
  if (rgDigits.length >= 7 && rgDigits.length <= 12) {
    return { documento: true, tipo: "rg" };
  }

  const cnh = text.match(
    /\b(?:CNH|NUMERO DA CNH|REGISTRO CNH)\b[^\d]{0,15}(\d[\d.\s-]{8,16})/,
  )?.[1];
  const cnhDigits = cnh?.replace(/\D/g, "") ?? "";
  if (cnhDigits.length >= 9 && cnhDigits.length <= 12) {
    return { documento: true, tipo: "cnh" };
  }

  return { documento: false, tipo: null };
}

export const documentoDetectorInternals = {
  cpfValid,
  cnpjValid,
};
