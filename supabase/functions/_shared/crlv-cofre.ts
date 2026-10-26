import type { CrlvParserResultado } from "./crlv-parser.ts";

export const CRLV_STOCK_FIELDS = new Set([
  "placa",
  "renavam",
  "chassi",
  "marca",
  "modelo",
  "versao",
  "ano_fabricacao",
  "ano_modelo",
  "cor",
  "combustivel",
  "cilindrada_cc",
]);

export function maskOwnerDocument(value: string | null): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `***.***.${digits.slice(6, 9)}-**`;
  }
  if (digits.length === 14) {
    return `**.***.***/****-${digits.slice(-2)}`;
  }
  return null;
}

function firstName(value: string | null): string | null {
  const first = String(value ?? "").trim().split(/\s+/)[0];
  return first
    ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
    : null;
}

export function safeCrlvReading(parser: CrlvParserResultado) {
  return {
    veiculo: parser.veiculo,
    documento: parser.documento,
    observacoes: parser.observacoes,
    proprietario: {
      primeiro_nome: firstName(parser.proprietario.nome.valor),
      cpf_cnpj_mascarado: maskOwnerDocument(
        parser.proprietario.cpf_cnpj.valor,
      ),
    },
    fonte: parser.fonte,
    leitura_fraca: parser.leitura_fraca,
  };
}

function sanitizeVehicleValue(
  key: string,
  value: unknown,
): string | number | null {
  if (value == null || value === "") return null;
  if (["ano_fabricacao", "ano_modelo", "cilindrada_cc"].includes(key)) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }
  const text = String(value).trim();
  if (!text) return null;
  if (["placa", "renavam", "chassi"].includes(key)) {
    return text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  }
  return text;
}

export function sanitizeCrlvVehicleValues(
  values: Record<string, unknown>,
): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([key]) => CRLV_STOCK_FIELDS.has(key))
      .map(([key, value]) => [key, sanitizeVehicleValue(key, value)])
      .filter((entry): entry is [string, string | number] => entry[1] != null),
  );
}

export function buildCrlvVehiclePatch(
  current: Record<string, unknown>,
  values: Record<string, string | number>,
  replace: Set<string>,
): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(values).filter(([key]) =>
      current[key] == null || current[key] === "" || replace.has(key)
    ),
  );
}
