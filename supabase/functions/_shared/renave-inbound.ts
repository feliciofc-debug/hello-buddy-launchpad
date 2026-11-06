import type { GestaoAuthContext } from "./gestao-auth-phone.ts";
import { isGestaoNegative } from "./gestao-intent-pt.ts";
import { ownerPhonesEquivalent } from "./owner-phone.ts";
import {
  chamarRenave,
  type RenaveEnvironment,
  type RenaveResponse,
} from "./renave-client.ts";
import {
  decryptRenaveOperatorProfile,
  decryptRenaveSensitiveState,
  encryptRenaveOperatorProfile,
  encryptRenaveSensitiveState,
  type RenaveSensitiveState,
} from "./renave-state-crypto.ts";
import { fetchViaCep, type ViaCepAddress } from "./viacep-client.ts";
import { normalizeBrazilianPlate } from "./vehicle-plate.ts";

const PENDING_TTL_MS = 15 * 60 * 1000;
const RENAVE_WA_PREFIX = "renave_wa:";
const MOCK_TYPE = "AZUL" as const;

type RenaveCaller = (
  input: Record<string, unknown>,
) => Promise<RenaveResponse>;

export type RenaveInteractiveButtons = {
  body: string;
  buttons: { id: string; title: string }[];
};

export type RenaveInteractiveList = {
  body: string;
  button: string;
  section_title: string;
  rows: Array<{ id: string; title: string; description?: string }>;
};

export type RenaveMockState = {
  ambiente: "hom";
  placa: string;
  renavam: string;
  numeroCrv: string;
  tipoCrv: CrvType;
  sensivel_cifrado?: string | null;
  created_at: string;
};

export type PendingRenaveEntry = {
  phase:
    | "crv"
    | "operador_cpf"
    | "email_estabelecimento"
    | "email_vendedor"
    | "compra"
    | "km"
    | "valor"
    | "data"
    | "data_custom"
    | "proprietario"
    | "confirm"
    | "corrigir";
  placa: string;
  origem_pedido?: RenaveOrigin;
  mensagem_pedido_id?: string | null;
  renavam?: string;
  numeroCrv?: string;
  tipoCrv?: CrvType;
  quilometragem?: number;
  valorCompra?: number;
  dataCompra?: string;
  sensivel_cifrado?: string;
  tentativas?: Record<string, number>;
  expires_at: string;
};

export type RenaveDocument = {
  filename: string;
  caption: string;
  base64: string;
};

type MunicipioOption = {
  id: number;
  nome: string;
  uf: string;
};

export type PendingRenaveExit = {
  phase:
    | "dados"
    | "documento"
    | "nome"
    | "operador_cpf"
    | "email_estabelecimento"
    | "email_comprador"
    | "cep"
    | "logradouro"
    | "bairro"
    | "cidade"
    | "numero"
    | "codigo_crv"
    | "valor"
    | "data"
    | "data_custom"
    | "municipio"
    | "confirm"
    | "corrigir";
  placa: string;
  origem_pedido?: RenaveOrigin;
  mensagem_pedido_id?: string | null;
  idEstoque: number;
  renavam: string;
  numeroCrv?: string;
  codigoMunicipio?: number;
  valorVenda?: number;
  dataVenda?: string;
  sensivel_cifrado?: string;
  municipios?: MunicipioOption[];
  tentativas?: Record<string, number>;
  expires_at: string;
};

type PendingRenavePlateAction = {
  action: "entrada" | "saida" | "documentos" | "nota";
  origem_pedido: RenaveOrigin;
  mensagem_pedido_id?: string | null;
  expires_at: string;
};

type PendingRenaveInvoice = {
  phase: "chave" | "codigo_crv";
  placa: string;
  renavam: string;
  idEstoque: number;
  origem_pedido: RenaveOrigin;
  mensagem_pedido_id?: string | null;
  expires_at: string;
};

type CrvType = "AZUL" | "VERDE" | "BRANCO" | "DIGITAL";

export type ParsedRenaveCommand =
  | { kind: "menu" }
  | { kind: "teste" }
  | { kind: "estoque" }
  | { kind: "aptidao"; placa: string; text: string }
  | { kind: "entrada"; placa: string }
  | { kind: "detran"; placa: string }
  | { kind: "nota"; placa: string }
  | { kind: "saida"; placa: string }
  | { kind: "documentos"; placa: string }
  | null;

function normalizeText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

function activePending(value: unknown, now: Date): PendingRenaveEntry | null {
  const pending = record(value) as Partial<PendingRenaveEntry>;
  if (
    ![
      "crv",
      "operador_cpf",
      "email_estabelecimento",
      "email_vendedor",
      "compra",
      "km",
      "valor",
      "data",
      "data_custom",
      "proprietario",
      "confirm",
      "corrigir",
    ].includes(String(pending.phase)) ||
    !normalizeBrazilianPlate(pending.placa) ||
    typeof pending.expires_at !== "string" ||
    Date.parse(pending.expires_at) <= now.getTime()
  ) {
    return null;
  }
  return pending as PendingRenaveEntry;
}

function activePendingExit(
  value: unknown,
  now: Date,
): PendingRenaveExit | null {
  const pending = record(value) as Partial<PendingRenaveExit>;
  if (
    ![
      "dados",
      "documento",
      "nome",
      "operador_cpf",
      "email_estabelecimento",
      "email_comprador",
      "cep",
      "logradouro",
      "bairro",
      "cidade",
      "numero",
      "codigo_crv",
      "valor",
      "data",
      "data_custom",
      "municipio",
      "confirm",
      "corrigir",
    ].includes(String(pending.phase)) ||
    !normalizeBrazilianPlate(pending.placa) ||
    !Number.isSafeInteger(Number(pending.idEstoque)) ||
    Number(pending.idEstoque) <= 0 ||
    typeof pending.expires_at !== "string" ||
    Date.parse(pending.expires_at) <= now.getTime()
  ) {
    return null;
  }
  return pending as PendingRenaveExit;
}

function activePendingPlateAction(
  value: unknown,
  now: Date,
): PendingRenavePlateAction | null {
  const pending = record(value) as Partial<PendingRenavePlateAction>;
  return ["entrada", "saida", "documentos", "nota"].includes(
      String(pending.action),
    ) &&
      (pending.origem_pedido === "texto" ||
        pending.origem_pedido === "audio") &&
      typeof pending.expires_at === "string" &&
      Date.parse(pending.expires_at) > now.getTime()
    ? pending as PendingRenavePlateAction
    : null;
}

function activePendingInvoice(
  value: unknown,
  now: Date,
): PendingRenaveInvoice | null {
  const pending = record(value) as Partial<PendingRenaveInvoice>;
  return ["chave", "codigo_crv"].includes(String(pending.phase)) &&
      Boolean(normalizeBrazilianPlate(pending.placa)) &&
      /^\d{11}$/.test(String(pending.renavam ?? "")) &&
      Number.isSafeInteger(Number(pending.idEstoque)) &&
      Number(pending.idEstoque) > 0 &&
      (pending.origem_pedido === "texto" ||
        pending.origem_pedido === "audio") &&
      typeof pending.expires_at === "string" &&
      Date.parse(pending.expires_at) > now.getTime()
    ? pending as PendingRenaveInvoice
    : null;
}

export function hasPendingRenaveEntry(
  agentState: Record<string, unknown>,
): boolean {
  return Boolean(
    agentState.pending_renave_entrada ||
      agentState.pending_renave_saida ||
      agentState.pending_renave_placa ||
      agentState.pending_renave_nota,
  );
}

export function parseRenaveCommand(text: string): ParsedRenaveCommand {
  const normalized = normalizeText(text);
  if (!/\brenave\b/.test(normalized)) return null;
  if (/^\s*renave\s*$/i.test(normalized)) return { kind: "menu" };
  if (/\bteste\b/.test(normalized)) return { kind: "teste" };
  if (/\bestoque\b/.test(normalized)) return { kind: "estoque" };
  const placa = normalizeBrazilianPlate(
    String(text).toUpperCase().match(
      /\b([A-Z]{3}[-\s]?[0-9][A-Z0-9]?[-\s]?[0-9]{2})\b/,
    )?.[1],
  );
  if (!placa) return null;
  if (/\b(?:aptidao|consulta)\b/.test(normalized)) {
    return { kind: "aptidao", placa, text };
  }
  if (/\bentrada\b/.test(normalized)) return { kind: "entrada", placa };
  if (/\bdetran\b/.test(normalized)) return { kind: "detran", placa };
  if (/\bnota\b/.test(normalized)) return { kind: "nota", placa };
  if (/\bsaida\b/.test(normalized)) return { kind: "saida", placa };
  if (/\bdocumentos?\b/.test(normalized)) {
    return { kind: "documentos", placa };
  }
  return null;
}

function parseInteractiveAction(
  value: string | null | undefined,
): string | null {
  const text = String(value ?? "");
  return text.match(/<<INTERACTIVE_ID:renave_wa:([^>]+)>>/i)?.[1]?.trim() ??
    text.match(/^renave_wa:(.+)$/i)?.[1]?.trim() ??
    null;
}

function commandFromInteractive(
  interactive: string | null,
): ParsedRenaveCommand {
  if (!interactive) return null;
  if (interactive === "menu_teste") return { kind: "teste" };
  if (interactive === "menu_estoque" || interactive === "estoque") {
    return { kind: "estoque" };
  }
  const match = interactive.match(
    /^(aptidao|entrada|detran|nota|saida|documentos):([A-Z]{3}[0-9][A-Z0-9][0-9]{2})$/i,
  );
  if (!match) return null;
  const placa = normalizeBrazilianPlate(match[2]);
  if (!placa) return null;
  const action = normalizeText(match[1]);
  if (action === "aptidao") {
    return {
      kind: "aptidao",
      placa,
      text: `renave aptidão ${placa}`,
    };
  }
  if (action === "entrada") return { kind: "entrada", placa };
  if (action === "detran") return { kind: "detran", placa };
  if (action === "nota") return { kind: "nota", placa };
  if (action === "saida") return { kind: "saida", placa };
  return { kind: "documentos", placa };
}

function onlyOwner(fromNumber: string, auth: GestaoAuthContext): boolean {
  return [auth.ownerPhone, ...auth.ownerAltPhones].some((phone) =>
    ownerPhonesEquivalent(phone, fromNumber)
  );
}

function enabledForUser(userId: string): boolean {
  return (Deno.env.get("AMZ_RENAVE_HOM_USER_IDS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(userId);
}

function configuredEnvironment(): RenaveEnvironment {
  return Deno.env.get("AMZ_RENAVE_AMBIENTE")?.trim().toLowerCase() === "prod"
    ? "prod"
    : "hom";
}

function randomIndex(length: number): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! % length;
}

export function generateRenaveMockSuffix(): string {
  const digits = "0123456789";
  const letters = "ABCDEFGHIJ";
  return `${digits[randomIndex(10)]}${letters[randomIndex(letters.length)]}${
    digits[randomIndex(10)]
  }${digits[randomIndex(10)]}`;
}

function cpfCheckDigit(digits: number[], length: number): number {
  const sum = digits.slice(0, length).reduce(
    (total, digit, index) => total + digit * (length + 1 - index),
    0,
  );
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function generateValidCpf(): string {
  const digits = Array.from(
    crypto.getRandomValues(new Uint8Array(9)),
    (value) => value % 10,
  );
  if (digits.every((digit) => digit === digits[0])) return generateValidCpf();
  digits.push(cpfCheckDigit(digits, 9));
  digits.push(cpfCheckDigit(digits, 10));
  return digits.join("");
}

function validCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const digits = [...value].map(Number);
  return digits[9] === cpfCheckDigit(digits, 9) &&
    digits[10] === cpfCheckDigit(digits, 10);
}

function validCnpj(value: string): boolean {
  if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;
  const digit = (length: number): number => {
    let factor = length - 7;
    let total = 0;
    for (let index = 0; index < length; index++) {
      total += Number(value[index]) * factor--;
      if (factor === 1) factor = 9;
    }
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return digit(12) === Number(value[12]) && digit(13) === Number(value[13]);
}

export function validateCpfCnpj(value: string): "CPF" | "CNPJ" | null {
  const digits = String(value || "").replace(/\D/g, "");
  if (validCpf(digits)) return "CPF";
  if (validCnpj(digits)) return "CNPJ";
  return null;
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) &&
    value.trim().length <= 254;
}

export function validateNfeKey(value: string): boolean {
  const key = String(value ?? "").replace(/\D/g, "");
  if (!/^\d{44}$/.test(key) || /^(\d)\1{43}$/.test(key)) return false;
  let sum = 0;
  let weight = 2;
  for (let index = 42; index >= 0; index--) {
    sum += Number(key[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  const digit = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
  return digit === Number(key[43]);
}

function findSecurityCode(text: string): string | null {
  return text.match(/(?<!\d)(\d{11})(?!\d)/)?.[1] ?? null;
}

export async function extractCrlvSecurityCode(
  pdfBase64: string,
): Promise<string | null> {
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(pdfBase64), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(bytes);
  const direct = findSecurityCode(raw);
  if (direct) return direct;
  const marker = new TextEncoder().encode("stream");
  const endMarker = new TextEncoder().encode("endstream");
  const indexOf = (needle: Uint8Array, start: number): number => {
    outer:
    for (let index = start; index <= bytes.length - needle.length; index++) {
      for (let offset = 0; offset < needle.length; offset++) {
        if (bytes[index + offset] !== needle[offset]) continue outer;
      }
      return index;
    }
    return -1;
  };
  let cursor = 0;
  while (cursor < bytes.length) {
    const streamAt = indexOf(marker, cursor);
    if (streamAt < 0) break;
    const header = decoder.decode(
      bytes.slice(Math.max(0, streamAt - 200), streamAt),
    );
    let start = streamAt + marker.length;
    if (bytes[start] === 13) start++;
    if (bytes[start] === 10) start++;
    const end = indexOf(endMarker, start);
    if (end < 0) break;
    cursor = end + endMarker.length;
    if (!header.includes("FlateDecode")) continue;
    let streamEnd = end;
    while (
      streamEnd > start &&
      (bytes[streamEnd - 1] === 10 || bytes[streamEnd - 1] === 13)
    ) {
      streamEnd--;
    }
    try {
      const decompressed = await new Response(
        new Blob([bytes.slice(start, streamEnd)]).stream().pipeThrough(
          new DecompressionStream("deflate"),
        ),
      ).arrayBuffer();
      const code = findSecurityCode(decoder.decode(decompressed));
      if (code) return code;
    } catch {
      // Continue through other PDF streams.
    }
  }
  return null;
}

export function parseCrvDetails(text: string): {
  renavam: string;
  numeroCrv: string;
  codigoSegurancaCrv: string;
  tipoCrv: CrvType;
} | null {
  const renavam = text.match(/\brenavam\s*[:=-]?\s*(\d{11})\b/i)?.[1];
  const numeroCrv = text.match(
    /\b(?:numero\s+(?:do\s+)?)?crv\s*[:=-]?\s*(\d{12})\b/i,
  )?.[1];
  const codigo = text.match(
    /\b(?:codigo(?:\s+de)?\s+seguranca(?:\s+do)?\s+crv|codigo)\s*[:=-]?\s*(\d{11})\b/i,
  )?.[1];
  const tipo = text.match(
    /\b(?:tipo\s+crv|tipo)\s*[:=-]?\s*(AZUL|VERDE|BRANCO|DIGITAL)\b/i,
  )?.[1]
    ?.toUpperCase() as CrvType | undefined;
  return renavam && numeroCrv && codigo && tipo
    ? { renavam, numeroCrv, codigoSegurancaCrv: codigo, tipoCrv: tipo }
    : null;
}

export function parseAptitudeIdentifiers(text: string): {
  renavam: string;
  numeroCrv: string;
  tipoCrv: CrvType;
} | null {
  const renavam = text.match(/\brenavam\s*[:=-]?\s*(\d{11})\b/i)?.[1];
  const numeroCrv = text.match(
    /\b(?:numero\s+(?:do\s+)?)?crv\s*[:=-]?\s*(\d{12})\b/i,
  )?.[1];
  const tipo = text.match(
    /\b(?:tipo\s+crv|tipo)\s*[:=-]?\s*(AZUL|VERDE|BRANCO|DIGITAL)\b/i,
  )?.[1]?.toUpperCase() as CrvType | undefined;
  return renavam && numeroCrv
    ? { renavam, numeroCrv, tipoCrv: tipo ?? MOCK_TYPE }
    : null;
}

function parseMoney(value: string): number | null {
  const multiplier = /\bmil\b/i.test(value) ? 1000 : 1;
  const clean = value.replace(/[^\d,.-]/g, "").replace(/[.,]+$/, "");
  if (!clean || clean.startsWith("-")) return null;
  let normalized = clean;
  if (clean.includes(",")) {
    if ((clean.match(/,/g) ?? []).length !== 1) return null;
    const [integer, decimal] = clean.split(",");
    if (!/^\d{1,3}(?:\.\d{3})*$|^\d+$/.test(integer)) return null;
    if (!/^\d{1,2}$/.test(decimal)) return null;
    normalized = `${integer.replace(/\./g, "")}.${decimal}`;
  } else if (clean.includes(".")) {
    const groups = clean.split(".");
    if (
      groups.length === 2 &&
      /^\d+$/.test(groups[0]) &&
      /^\d{1,2}$/.test(groups[1])
    ) {
      normalized = clean;
    } else if (
      /^\d{1,3}$/.test(groups[0]) &&
      groups.slice(1).every((group) => /^\d{3}$/.test(group))
    ) {
      normalized = groups.join("");
    } else {
      return null;
    }
  }
  const parsed = Number(normalized) * multiplier;
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 99_999_999.99
    ? Math.round(parsed * 100) / 100
    : null;
}

export function parseRenaveKm(value: string): number | null {
  const multiplier = /\bmil\b/i.test(value) ? 1000 : 1;
  const raw = value.match(/(\d[\d.]*)/)?.[1] ?? "";
  if (!raw) return null;
  const normalized = /^\d{1,3}(?:\.\d{3})+$/.test(raw)
    ? raw.replace(/\./g, "")
    : raw;
  const parsed = Number(normalized) * multiplier;
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 9_999_999
    ? parsed
    : null;
}

export function parseRenaveMoney(value: string): number | null {
  return parseMoney(value);
}

function saoPauloDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function parseDate(value: string, now: Date): string | null {
  const normalized = normalizeText(value).trim();
  const today = saoPauloDate(now);
  if (normalized === "hoje") return today;
  if (normalized === "ontem") {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }
  const iso = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const br = value.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/);
  const year = br?.[3]
    ? String(br[3]).length === 2 ? `20${br[3]}` : br[3]
    : today.slice(0, 4);
  const candidate = iso
    ? `${iso[1]}-${iso[2]}-${iso[3]}`
    : br
    ? `${year}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`
    : null;
  if (!candidate) return null;
  const parsed = new Date(`${candidate}T12:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== candidate ||
    candidate > today
  ) return null;
  return candidate;
}

export function parseRenaveDate(
  value: string,
  now = new Date(),
): string | null {
  return parseDate(value, now);
}

export function parsePurchaseDetails(
  text: string,
  now = new Date(),
): {
  quilometragem: number;
  valorCompra: number;
  dataCompra: string;
  documentoProprietario?: string;
  tipoDocumento?: "CPF" | "CNPJ";
} | null {
  const kmRaw = text.match(
    /\b(?:km|quilometragem)\s*[:=-]?\s*([\d.]+(?:\s*mil)?)(?:\s*km)?\b/i,
  )
    ?.[1];
  const valueRaw = text.match(
    /\b(?:valor(?:\s+da\s+compra)?|compra)\s*[:=-]?\s*(?:R\$\s*)?([\d.,]+(?:\s*mil)?)\b/i,
  )?.[1];
  const dateRaw = text.match(
    /\b(?:data(?:\s+da\s+compra)?\s*[:=-]?\s*)?(hoje|ontem|\d{1,2}\/\d{1,2}(?:\/(?:\d{2}|\d{4}))?|\d{4}-\d{2}-\d{2})\b/i,
  )?.[1];
  const documentRaw = text.match(
    /\b(?:cpf|cnpj|documento)\s*[:=-]?\s*([\d./-]{11,18})\b/i,
  )?.[1];
  const quilometragem = kmRaw ? parseRenaveKm(kmRaw) : null;
  const valorCompra = valueRaw ? parseMoney(valueRaw) : null;
  const dataCompra = dateRaw ? parseDate(dateRaw, now) : null;
  if (
    quilometragem == null ||
    !Number.isSafeInteger(quilometragem) ||
    quilometragem < 0 ||
    quilometragem > 9_999_999 ||
    !valorCompra ||
    !dataCompra
  ) return null;
  if (!documentRaw) return { quilometragem, valorCompra, dataCompra };
  const documentoProprietario = documentRaw.replace(/\D/g, "");
  const tipoDocumento = validateCpfCnpj(documentoProprietario);
  return tipoDocumento
    ? {
      quilometragem,
      valorCompra,
      dataCompra,
      documentoProprietario,
      tipoDocumento,
    }
    : null;
}

function dateCandidate(text: string): string | null {
  return text.match(
    /\b(hoje|ontem|\d{1,2}\/\d{1,2}(?:\/(?:\d{2}|\d{4}))?|\d{4}-\d{2}-\d{2})\b/i,
  )?.[1] ?? null;
}

function labeledKm(text: string): number | null {
  const match = text.match(
    /\b(?:km|quilometragem)\s*[:=-]?\s*([\d.]+(?:\s*mil)?)(?:\s*km)?\b/i,
  )?.[1] ?? text.match(/\b([\d.]+(?:\s*mil)?)\s*km\b/i)?.[1];
  return match ? parseRenaveKm(match) : null;
}

function labeledMoney(text: string): number | null {
  const match = text.match(
    /\b(?:valor(?:\s+(?:da\s+)?(?:compra|venda))?|compra|venda)\s*[:=-]?\s*(?:R\$\s*)?([\d.,]+(?:\s*mil)?)\b/i,
  )?.[1] ?? text.match(/\bR\$\s*([\d.,]+(?:\s*mil)?)/i)?.[1];
  return match ? parseRenaveMoney(match) : null;
}

function retryCount(
  attempts: Record<string, number> | undefined,
  field: string,
): { attempts: Record<string, number>; count: number } {
  const count = Number(attempts?.[field] ?? 0) + 1;
  return {
    attempts: { ...(attempts ?? {}), [field]: count },
    count,
  };
}

function retryReply(
  question: string,
  example: string,
  count: number,
  kind: "entrada" | "saida",
  placa: string,
): {
  reply: string;
  interactiveButtons?: RenaveInteractiveButtons;
} {
  if (count < 3) return { reply: question };
  const reply = `${question}\nExemplo: ${example}`;
  return {
    reply,
    interactiveButtons: actionButtons(reply, [{
      action: `${kind}_cancelar`,
      placa,
      title: "❌ Cancelar",
    }]),
  };
}

function entryNextPhase(
  pending: PendingRenaveEntry,
  sensitive: RenaveSensitiveState,
): PendingRenaveEntry["phase"] {
  return !validCpf(sensitive.cpfOperadorResponsavel ?? "")
    ? "operador_cpf"
    : !validEmail(sensitive.emailEstabelecimento ?? "")
    ? "email_estabelecimento"
    : !validEmail(sensitive.emailVendedor ?? "")
    ? "email_vendedor"
    : pending.quilometragem == null
    ? "km"
    : pending.valorCompra == null
    ? "valor"
    : !pending.dataCompra
    ? "data"
    : !sensitive.documentoProprietario
    ? "proprietario"
    : "confirm";
}

function entryPhasePrompt(phase: PendingRenaveEntry["phase"]): string {
  if (phase === "operador_cpf") {
    return "Qual o seu CPF? Ele vai como operador responsável no RENAVE.";
  }
  if (phase === "email_estabelecimento") {
    return "Qual o e-mail do estabelecimento?";
  }
  if (phase === "email_vendedor") return "Qual o e-mail do vendedor?";
  if (phase === "km") return "Qual a km atual?";
  if (phase === "valor") return "Qual o valor da compra?";
  if (phase === "proprietario") {
    return "Qual o CPF/CNPJ do proprietário atual?";
  }
  return "Informe o próximo dado.";
}

function formatMoney(value: unknown): string {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
    : "R$ 0,00";
}

export function formatAptitude(body: unknown): {
  apto: boolean;
  reply: string;
} {
  const payload = record(body);
  const diagnostic = record(payload.diagnostico);
  const debts = record(payload.informacoesDebitos);
  const apto = diagnostic.veiculoApto === true;
  const reasons = Array.isArray(diagnostic.motivosParaNaoAptidao)
    ? diagnostic.motivosParaNaoAptidao.map(String).filter(Boolean)
    : [];
  const checks = [
    [
      "veiculoComRestricaoImpeditivaNoDetran",
      "Sem restrição Detran",
      "restrição Detran",
    ],
    ["veiculoComRestricaoJudicial", "Judicial", "restrição judicial"],
    ["veiculoComRestricaoNaReceitaFederal", "Receita", "restrição na Receita"],
    ["veiculoComRestricaoPgfn", "PGFN", "restrição PGFN"],
    ["veiculoComRouboFurto", "Sem roubo/furto", "roubo/furto"],
    ["veiculoComRecall", "Sem recall", "recall"],
    ["veiculoComAlarme", "Sem alarme", "alarme"],
  ].map(([key, okLabel, problemLabel]) =>
    diagnostic[key] === true ? `⚠️ ${problemLabel}` : `✅ ${okLabel}`
  );
  const debtLines = [
    ["IPVA", debts.valorDebitoIpva],
    ["Licenciamento", debts.valorDebitoLicenciamento],
    ["Multas", debts.valorDebitoMultas],
  ].map(([label, value]) => `${label} ${formatMoney(value ?? 0)}`);
  const problemChecks = checks.filter((line) => line.startsWith("⚠️"));
  const okChecks = checks.filter((line) => line.startsWith("✅"));
  if (payload.comunicacaoComDetranFalhou === true) {
    problemChecks.unshift("⚠️ Falha de comunicação com Detran");
  }
  if (diagnostic.veiculoBaixado === true) {
    problemChecks.push("⚠️ Veículo baixado");
  }
  return {
    apto,
    reply: [
      apto
        ? "✅ Apto para entrada no RENAVE."
        : "❌ Não apto para entrada no RENAVE.",
      ...(reasons.length ? [`Motivos: ${reasons.join("; ")}`] : []),
      ...problemChecks,
      okChecks.join(" · "),
      `Débitos: ${debtLines.join(" · ")}`,
    ].join("\n"),
  };
}

function errorMessage(result: RenaveResponse): string {
  const body = record(result.body);
  const finalMessage = stringValue(body.mensagemParaUsuarioFinal);
  if (result.status === 422 && finalMessage) return finalMessage;
  const detail = stringValue(body.detalhe);
  if (result.status === 400 && detail) {
    const safeDetail = detail.replace(/\d{11,44}/g, "[dado protegido]");
    return `Serpro (homologação): ${safeDetail.slice(0, 300)}`;
  }
  return finalMessage ||
    "Não foi possível concluir a operação RENAVE agora.";
}

async function operatorProfile(
  state: Record<string, unknown>,
): Promise<{
  cpfOperadorResponsavel?: string;
  emailEstabelecimento?: string;
}> {
  const encrypted = stringValue(state.renave_operador_cifrado);
  if (!encrypted) return {};
  try {
    return await decryptRenaveOperatorProfile(encrypted);
  } catch {
    return {};
  }
}

async function loadTenantEmail(
  sb: unknown,
  userId: string,
): Promise<string | null> {
  try {
    const client = sb as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => Promise<{
              data?: { email?: unknown } | null;
            }>;
          };
        };
      };
    };
    const { data } = await client.from("profiles").select("email").eq(
      "id",
      userId,
    ).maybeSingle();
    const email = stringValue(data?.email).trim();
    return validEmail(email) ? email : null;
  } catch {
    return null;
  }
}

async function applyOperatorProfile(
  input: {
    agentState: Record<string, unknown>;
    userId: string;
    sb?: unknown;
    dependencies?: {
      loadTenantEmail?: () => Promise<string | null>;
    };
  },
  sensitive: Awaited<ReturnType<typeof decryptRenaveSensitiveState>>,
): Promise<typeof sensitive> {
  const saved = await operatorProfile(input.agentState);
  let emailEstabelecimento = saved.emailEstabelecimento ??
    sensitive.emailEstabelecimento;
  if (!emailEstabelecimento) {
    emailEstabelecimento = await (input.dependencies?.loadTenantEmail ??
      (() => loadTenantEmail(input.sb, input.userId)))() ?? undefined;
  }
  return {
    ...sensitive,
    cpfOperadorResponsavel: saved.cpfOperadorResponsavel ??
      sensitive.cpfOperadorResponsavel,
    emailEstabelecimento,
  };
}

async function saveOperatorProfile(
  input: {
    agentState: Record<string, unknown>;
    saveAgentStatePatch: (
      patch: Record<string, unknown>,
      current: Record<string, unknown>,
    ) => Promise<boolean>;
  },
  profile: {
    cpfOperadorResponsavel?: string;
    emailEstabelecimento?: string;
  },
): Promise<void> {
  await input.saveAgentStatePatch({
    renave_operador_cifrado: await encryptRenaveOperatorProfile(profile),
  }, input.agentState);
}

async function callLogged(
  caller: RenaveCaller,
  input: Record<string, unknown>,
): Promise<RenaveResponse> {
  const started = performance.now();
  let status = 0;
  try {
    const result = await caller(input);
    status = result.status;
    return result;
  } catch {
    status = 503;
    return { status, body: {} };
  } finally {
    console.info("[renave-inbound]", {
      operacao: String(input.operacao ?? "invalida"),
      status,
      duracaoMs: Math.round(performance.now() - started),
    });
  }
}

function authenticatedClientUf(body: unknown): string {
  const payload = record(body);
  const endereco = record(payload.endereco);
  const municipio = record(endereco.municipio);
  const uf = stringValue(municipio.uf ?? endereco.uf ?? payload.uf)
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}$/.test(uf) ? uf : "SP";
}

function mockFromState(value: unknown, placa: string): RenaveMockState | null {
  const mock = record(value) as Partial<RenaveMockState>;
  return mock.ambiente === "hom" &&
      normalizeBrazilianPlate(mock.placa) === placa &&
      /^\d{11}$/.test(String(mock.renavam ?? "")) &&
      /^\d{12}$/.test(String(mock.numeroCrv ?? ""))
    ? mock as RenaveMockState
    : null;
}

async function runAptitude(
  caller: RenaveCaller,
  input: {
    placa: string;
    renavam: string;
    numeroCrv: string;
    tipoCrv: CrvType;
  },
): Promise<
  { ok: true; apto: boolean; reply: string } | {
    ok: false;
    reply: string;
  }
> {
  const result = await callLogged(caller, {
    ambiente: "hom",
    operacao: "aptidaoVeiculo",
    params: input,
  });
  if (result.status < 200 || result.status >= 300) {
    return { ok: false, reply: errorMessage(result) };
  }
  return { ok: true, ...formatAptitude(result.body) };
}

function nextExpiry(now: Date): string {
  return new Date(now.getTime() + PENDING_TTL_MS).toISOString();
}

function purchasePrompt(hasDocument: boolean): string {
  return `Informe em uma mensagem: km atual, valor da compra, data da compra (ou "hoje")${
    hasDocument ? "" : " e CPF/CNPJ do proprietário atual"
  }.\nExemplo: km 12000, valor 45000, data hoje${
    hasDocument ? "" : ", CPF 52998224725"
  }.`;
}

function crvPrompt(): string {
  return "Informe em uma mensagem: RENAVAM (11 dígitos), número do CRV (12), código de segurança do CRV (11) e tipo CRV (AZUL, VERDE, BRANCO ou DIGITAL).";
}

function renaveActionId(action: string, placa?: string): string {
  return `${RENAVE_WA_PREFIX}${action}${placa ? `:${placa}` : ""}`;
}

function isRenaveAction(
  interactive: string | null,
  action: string,
  placa?: string,
): boolean {
  return interactive === action ||
    interactive === `${action}:${placa ?? ""}`;
}

function confirmationButtons(
  reply: string,
  kind: "entrada" | "saida",
  placa: string,
): RenaveInteractiveButtons {
  return {
    body: reply,
    buttons: [
      {
        id: renaveActionId(`${kind}_confirmar`, placa),
        title: "✅ Confirmar",
      },
      {
        id: renaveActionId(`${kind}_corrigir`, placa),
        title: "✏️ Corrigir",
      },
      {
        id: renaveActionId(`${kind}_cancelar`, placa),
        title: "❌ Cancelar",
      },
    ],
  };
}

function dateButtons(
  kind: "entrada" | "saida",
  placa: string,
): RenaveInteractiveButtons {
  const body = `Qual a data da ${kind === "entrada" ? "compra" : "venda"}?`;
  return {
    body,
    buttons: [
      {
        id: renaveActionId(`${kind}_data_hoje`, placa),
        title: "Hoje",
      },
      {
        id: renaveActionId(`${kind}_data_ontem`, placa),
        title: "Ontem",
      },
      {
        id: renaveActionId(`${kind}_data_outra`, placa),
        title: "Outra data",
      },
    ],
  };
}

function actionButtons(
  body: string,
  actions: Array<{ action: string; placa?: string; title: string }>,
): RenaveInteractiveButtons {
  return {
    body,
    buttons: actions.slice(0, 3).map((item) => ({
      id: renaveActionId(item.action, item.placa),
      title: item.title,
    })),
  };
}

function renaveMenu(): RenaveInteractiveList {
  return {
    body: "O que você quer fazer no RENAVE?",
    button: "Ver opções",
    section_title: "RENAVE",
    rows: [
      {
        id: renaveActionId("menu_teste"),
        title: "Novo carro de teste",
        description: "Somente homologação",
      },
      { id: renaveActionId("menu_estoque"), title: "Estoque RENAVE" },
      { id: renaveActionId("menu_entrada"), title: "Dar entrada" },
      { id: renaveActionId("menu_saida"), title: "Dar saída" },
      { id: renaveActionId("menu_documentos"), title: "Documentos" },
    ],
  };
}

function correctionList(
  kind: "entrada" | "saida",
  placa: string,
): RenaveInteractiveList {
  const fields = kind === "entrada"
    ? [
      ["km", "Quilometragem"],
      ["valor", "Valor da compra"],
      ["data", "Data da compra"],
    ]
    : [
      ["documento", "CPF/CNPJ"],
      ["nome", "Nome do comprador"],
      ["cep", "CEP/endereço"],
      ["numero", "Número"],
      ["valor", "Valor da venda"],
      ["data", "Data da venda"],
    ];
  return {
    body: "Qual campo você quer corrigir?",
    button: "Escolher campo",
    section_title: "Campos",
    rows: fields.map(([field, title]) => ({
      id: renaveActionId(`${kind}_corrigir_${field}`, placa),
      title,
    })),
  };
}

function saoPauloDateTime(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${
    part("minute")
  }:${part("second")}`;
}

type RenaveMovementType =
  | "entrada"
  | "saida"
  | "detran_simulado"
  | "cancelamento";

type RenaveOrigin = "texto" | "audio";

function maskedRequester(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  return `***${digits.slice(-4).padStart(4, "0")}`;
}

async function recordRenaveMovement(input: {
  sb: unknown;
  userId: string;
  fromNumber: string;
  origem: RenaveOrigin;
  mensagemId?: string | null;
  mensagemConfirmacaoId?: string | null;
  tipo: RenaveMovementType;
  placa: string;
  statusHttp: number;
  idEstoque?: number | null;
  estadoEstoque?: string | null;
  valor?: number | null;
  dataOperacao?: string | null;
}): Promise<void> {
  if (!input.sb) return;
  const started = performance.now();
  try {
    const db = input.sb as {
      from: (table: string) => {
        insert: (row: Record<string, unknown>) => Promise<{
          error?: { message?: string } | null;
        }>;
      };
    };
    const { error } = await db.from("renave_movimentos").insert({
      user_id: input.userId,
      ambiente: "hom",
      tipo: input.tipo,
      placa: input.placa,
      id_estoque: input.idEstoque ?? null,
      estado_estoque: input.estadoEstoque ?? null,
      valor: input.valor ?? null,
      data_operacao: input.dataOperacao ?? null,
      solicitado_por: maskedRequester(input.fromNumber),
      origem: input.origem,
      mensagem_origem_id: input.mensagemId ?? null,
      mensagem_confirmacao_id: input.mensagemConfirmacaoId ?? null,
      status_http: input.statusHttp,
    });
    if (error) throw new Error(error.message || "insert falhou");
  } catch {
    console.warn("[renave-movimento] falha", {
      operacao: "gravarMovimento",
      status: 500,
      duracaoMs: Math.round(performance.now() - started),
    });
  }
}

function vehicleContexts(
  state: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const contexts = record(state.renave_veiculos);
  return Object.fromEntries(
    Object.entries(contexts).filter(([, value]) =>
      value && typeof value === "object" && !Array.isArray(value)
    ),
  ) as Record<string, Record<string, unknown>>;
}

function updatedVehicleContexts(
  state: Record<string, unknown>,
  placa: string,
  patch: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const contexts = vehicleContexts(state);
  return {
    ...contexts,
    [placa]: {
      ...record(contexts[placa]),
      ...patch,
      updated_at: new Date().toISOString(),
    },
  };
}

function clearExitPatch() {
  return { pending_renave_saida: null };
}

function exitPrompt(hasSecurityCode: boolean): string {
  return [
    "Informe em uma mensagem:",
    "CPF/CNPJ do comprador, nome, CEP, rua, número, bairro, cidade/UF, valor da venda e data (ou hoje).",
    ...(hasSecurityCode
      ? []
      : ["Inclua também o código de segurança do CRV (11 dígitos)."]),
    `Exemplo: CPF 52998224725, nome JOAO SILVA, CEP 20040020, rua Avenida Rio Branco, número 10, bairro Centro, cidade Rio de Janeiro/RJ, valor 60000, data hoje${
      hasSecurityCode ? "" : ", código 12345678901"
    }.`,
  ].join("\n");
}

export function parseExitDetails(
  text: string,
  now = new Date(),
): {
  documento: string;
  tipoDocumento: "CPF" | "CNPJ";
  nome: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  valorVenda: number;
  dataVenda: string;
  codigoSegurancaCrv?: string;
} | null {
  const field = (pattern: RegExp) => text.match(pattern)?.[1]?.trim() ?? "";
  const documento = field(
    /\b(?:cpf|cnpj|documento)\s*[:=-]?\s*([\d./-]{11,18})/i,
  ).replace(/\D/g, "");
  const tipoDocumento = validateCpfCnpj(documento);
  const nome = field(/\bnome\s*[:=-]?\s*([^,\n]{2,40})/i);
  const cep = field(/\bcep\s*[:=-]?\s*([\d-]{7,9})/i).replace(/\D/g, "");
  const logradouro = field(
    /\b(?:rua|logradouro|endere[cç]o)\s*[:=-]?\s*([^,\n]{2,30})/i,
  );
  const numero = field(/\bn[uú]mero\s*[:=-]?\s*([^,\n]{1,5})/i);
  const bairro = field(/\bbairro\s*[:=-]?\s*([^,\n]{2,20})/i);
  const cityMatch = text.match(
    /\bcidade\s*[:=-]?\s*([^,\n/]{2,40})\s*\/\s*([A-Z]{2})\b/i,
  );
  const cidade = cityMatch?.[1]?.trim() ?? "";
  const uf = cityMatch?.[2]?.toUpperCase() ?? "";
  const valueRaw = field(
    /\b(?:valor(?:\s+da\s+venda)?|venda)\s*[:=-]?\s*(?:R\$\s*)?([\d.,]+)/i,
  );
  const dateRaw = field(
    /\bdata(?:\s+da\s+venda)?\s*[:=-]?\s*(hoje|\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
  );
  const codigo = field(
    /\b(?:c[oó]digo(?:\s+de)?\s+seguran[cç]a(?:\s+do)?\s+crv|c[oó]digo)\s*[:=-]?\s*(\d{11})\b/i,
  );
  const valorVenda = parseMoney(valueRaw);
  const dataVenda = parseDate(dateRaw, now);
  if (
    !tipoDocumento ||
    !nome ||
    !/^\d{7,8}$/.test(cep) ||
    !logradouro ||
    !numero ||
    !bairro ||
    !cidade ||
    !/^[A-Z]{2}$/.test(uf) ||
    !valorVenda ||
    !dataVenda ||
    (codigo && !/^\d{11}$/.test(codigo))
  ) {
    return null;
  }
  return {
    documento,
    tipoDocumento,
    nome,
    cep,
    logradouro,
    numero,
    bairro,
    cidade,
    uf,
    valorVenda,
    dataVenda,
    ...(codigo ? { codigoSegurancaCrv: codigo } : {}),
  };
}

function municipalityOptions(
  body: unknown,
  requestedCity: string,
  requestedUf: string,
): MunicipioOption[] {
  if (!Array.isArray(body)) return [];
  const normalizedCity = normalizeText(requestedCity).trim();
  const normalizedUf = requestedUf.trim().toUpperCase();
  return body.flatMap((item) => {
    const row = record(item);
    const id = Number(row.id);
    const nome = stringValue(row.nome).trim();
    const uf = stringValue(row.uf).toUpperCase();
    return Number.isSafeInteger(id) &&
        id > 0 &&
        normalizeText(nome).trim() === normalizedCity &&
        uf === normalizedUf
      ? [{ id, nome, uf }]
      : [];
  });
}

function safePdf(value: unknown): string | null {
  const base64 = typeof value === "string" ? value.trim() : "";
  return base64.length >= 8 &&
      base64.length <= 20_000_000 &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(base64) &&
      base64.startsWith("JVBER")
    ? base64
    : null;
}

function crlvPdf(body: unknown): string | null {
  const payload = record(body);
  return safePdf(
    payload.pdfCodigoSegurancaCrvBase64 ??
      payload.pdfBase64 ??
      payload.crlveBase64,
  );
}

async function fetchRenaveDocuments(
  caller: RenaveCaller,
  input: {
    placa: string;
    renavam: string;
    idEstoque: number;
  },
): Promise<RenaveDocument[]> {
  const requests = [
    {
      operation: "pdfAtpv",
      params: { placa: input.placa, renavam: input.renavam },
      filename: `atpv-e-${input.placa}.pdf`,
      caption: "ATPV-e",
      field: "pdfAtpvBase64",
    },
    {
      operation: "termoEntrada",
      params: { idEstoque: input.idEstoque },
      filename: `termo-entrada-${input.placa}.pdf`,
      caption: "Termo de entrada RENAVE",
      field: "pdfBase64",
    },
    {
      operation: "termoSaida",
      params: { idEstoque: input.idEstoque },
      filename: `termo-saida-${input.placa}.pdf`,
      caption: "Termo de saída RENAVE",
      field: "pdfBase64",
    },
    {
      operation: "crlve",
      params: {
        placaVeiculo: input.placa,
        renavamVeiculo: input.renavam,
      },
      filename: `crlv-e-${input.placa}.pdf`,
      caption: "CRLV-e",
      field: "pdfBase64",
    },
  ] as const;
  const results = await Promise.all(
    requests.map(async (request) => {
      try {
        return {
          request,
          response: await callLogged(caller, {
            ambiente: "hom",
            operacao: request.operation,
            params: request.params,
          }),
        };
      } catch {
        return { request, response: null };
      }
    }),
  );
  return results.flatMap(({ request, response }) => {
    if (!response) return [];
    if (response.status < 200 || response.status >= 300) return [];
    const base64 = request.operation === "crlve"
      ? crlvPdf(response.body)
      : safePdf(record(response.body)[request.field]);
    return base64
      ? [{
        filename: request.filename,
        caption: request.caption,
        base64,
      }]
      : [];
  });
}

async function findStockByPlate(
  caller: RenaveCaller,
  placa: string,
): Promise<
  { response: RenaveResponse; stock: Record<string, unknown> | null }
> {
  const response = await callLogged(caller, {
    ambiente: "hom",
    operacao: "consultarEstoques",
    params: { placa },
  });
  const rows = Array.isArray(response.body) ? response.body : [];
  const stock =
    rows.map(record).find((row) =>
      normalizeBrazilianPlate(row.placa) === placa
    ) ?? null;
  return { response, stock };
}

function clearSensitivePatch(agentState: Record<string, unknown>) {
  const mock = record(agentState.renave_mock_ultimo);
  return {
    pending_renave_entrada: null,
    ...(Object.keys(mock).length
      ? {
        renave_mock_ultimo: {
          ...mock,
          sensivel_cifrado: null,
        },
      }
      : {}),
  };
}

export async function tryProcessRenaveInbound(input: {
  userId: string;
  fromNumber: string;
  userText: string;
  interactiveId?: string | null;
  hasInboundMedia: boolean;
  auth: GestaoAuthContext;
  agentState: Record<string, unknown>;
  saveAgentStatePatch: (
    patch: Record<string, unknown>,
    current: Record<string, unknown>,
  ) => Promise<boolean>;
  sb?: unknown;
  origem?: RenaveOrigin;
  mensagemId?: string | null;
  dependencies?: {
    callRenave?: RenaveCaller;
    now?: () => Date;
    mockSuffix?: () => string;
    mockCpf?: () => string;
    fetchViaCep?: (cep: string) => Promise<ViaCepAddress | null>;
    loadTenantEmail?: () => Promise<string | null>;
  };
}): Promise<{
  handled: boolean;
  reply?: string;
  interactiveButtons?: RenaveInteractiveButtons;
  interactiveList?: RenaveInteractiveList;
  documents?: RenaveDocument[];
}> {
  if (input.hasInboundMedia) return { handled: false };
  if (
    !enabledForUser(input.userId) || !onlyOwner(input.fromNumber, input.auth)
  ) {
    return { handled: false };
  }

  const now = input.dependencies?.now?.() ?? new Date();
  const origem = input.origem ?? "texto";
  const rawPending = input.agentState.pending_renave_entrada;
  const pending = activePending(rawPending, now);
  const rawExit = input.agentState.pending_renave_saida;
  const pendingExit = activePendingExit(rawExit, now);
  const rawPlateAction = input.agentState.pending_renave_placa;
  const pendingPlateAction = activePendingPlateAction(rawPlateAction, now);
  const rawInvoice = input.agentState.pending_renave_nota;
  const pendingInvoice = activePendingInvoice(rawInvoice, now);
  const interactive = parseInteractiveAction(
    input.interactiveId || input.userText,
  );
  let command = parseRenaveCommand(input.userText) ||
    commandFromInteractive(interactive);
  let commandOrigin = origem;
  let commandMessageId = input.mensagemId;
  if (!command && pendingPlateAction) {
    const placa = normalizeBrazilianPlate(
      input.userText.toUpperCase().match(
        /\b([A-Z]{3}[-\s]?[0-9][A-Z0-9]?[-\s]?[0-9]{2})\b/,
      )?.[1],
    );
    if (placa) {
      command = pendingPlateAction.action === "entrada"
        ? { kind: "entrada", placa }
        : pendingPlateAction.action === "saida"
        ? { kind: "saida", placa }
        : pendingPlateAction.action === "nota"
        ? { kind: "nota", placa }
        : { kind: "documentos", placa };
      commandOrigin = pendingPlateAction.origem_pedido;
      commandMessageId = pendingPlateAction.mensagem_pedido_id;
      await input.saveAgentStatePatch(
        { pending_renave_placa: null },
        input.agentState,
      );
    }
  }
  if (
    !rawPending && !rawExit && !rawPlateAction && !rawInvoice && !command &&
    !interactive
  ) {
    return { handled: false };
  }

  if (configuredEnvironment() === "prod") {
    if (rawPending || rawExit || rawPlateAction || rawInvoice) {
      await input.saveAgentStatePatch(
        {
          ...clearSensitivePatch(input.agentState),
          ...clearExitPatch(),
          pending_renave_placa: null,
          pending_renave_nota: null,
        },
        input.agentState,
      );
    }
    return {
      handled: true,
      reply: "RENAVE em produção ainda não liberado",
    };
  }

  if (rawPending && !pending) {
    await input.saveAgentStatePatch(
      clearSensitivePatch(input.agentState),
      input.agentState,
    );
    return {
      handled: true,
      reply: "O fluxo de entrada RENAVE expirou. Envie o comando novamente.",
    };
  }
  if (rawExit && !pendingExit) {
    await input.saveAgentStatePatch(clearExitPatch(), input.agentState);
    return {
      handled: true,
      reply: "O fluxo de saída RENAVE expirou. Envie o comando novamente.",
    };
  }
  if (rawPlateAction && !pendingPlateAction) {
    await input.saveAgentStatePatch(
      { pending_renave_placa: null },
      input.agentState,
    );
    return {
      handled: true,
      reply: "O pedido de placa expirou. Abra o menu RENAVE novamente.",
    };
  }
  if (rawInvoice && !pendingInvoice) {
    await input.saveAgentStatePatch(
      { pending_renave_nota: null },
      input.agentState,
    );
    return {
      handled: true,
      reply: "O envio da nota expirou. Envie o comando novamente.",
    };
  }
  if (pendingPlateAction && !command) {
    return {
      handled: true,
      reply: "Qual é a placa do veículo?",
    };
  }
  const menuPlateAction = interactive?.match(
    /^menu_(entrada|saida|documentos)$/,
  )?.[1] as PendingRenavePlateAction["action"] | undefined;
  if (menuPlateAction) {
    const next: PendingRenavePlateAction = {
      action: menuPlateAction,
      origem_pedido: commandOrigin,
      mensagem_pedido_id: commandMessageId,
      expires_at: nextExpiry(now),
    };
    await input.saveAgentStatePatch(
      { pending_renave_placa: next },
      input.agentState,
    );
    return { handled: true, reply: "Qual é a placa do veículo?" };
  }
  if (command?.kind === "menu") {
    const menu = renaveMenu();
    return {
      handled: true,
      reply: menu.body,
      interactiveList: menu,
    };
  }
  if (/^cancelar(?::[A-Z0-9]{7})?$/.test(interactive ?? "")) {
    return { handled: true, reply: "Operação RENAVE cancelada." };
  }

  const caller = input.dependencies?.callRenave ?? chamarRenave as RenaveCaller;
  if (pendingInvoice) {
    if (
      /^cancelar\b/i.test(input.userText.trim()) ||
      isGestaoNegative(input.userText)
    ) {
      await input.saveAgentStatePatch(
        { pending_renave_nota: null },
        input.agentState,
      );
      return { handled: true, reply: "Envio da NF-e cancelado." };
    }
    if (pendingInvoice.phase === "codigo_crv") {
      const code = input.userText.match(/(?<!\d)(\d{11})(?!\d)/)?.[1];
      if (!code) {
        return {
          handled: true,
          reply: "Informe o código de segurança do CRV novo com 11 dígitos.",
        };
      }
      const current = record(
        vehicleContexts(input.agentState)[pendingInvoice.placa],
      );
      let sensitive: RenaveSensitiveState = {
        documentoProprietario: "",
        codigoSegurancaCrv: code,
      };
      const encrypted = stringValue(current.sensivel_cifrado);
      if (encrypted) {
        try {
          sensitive = {
            ...(await decryptRenaveSensitiveState(encrypted)),
            codigoSegurancaCrv: code,
          };
        } catch {
          // Replace an invalid stale vehicle secret.
        }
      }
      await input.saveAgentStatePatch({
        pending_renave_nota: null,
        renave_veiculos: updatedVehicleContexts(
          input.agentState,
          pendingInvoice.placa,
          {
            nf_entrada_enviada: true,
            crv_novo_disponivel: true,
            sensivel_cifrado: await encryptRenaveSensitiveState(sensitive),
          },
        ),
      }, input.agentState);
      return {
        handled: true,
        reply: "✅ Código do CRV novo guardado. A saída RENAVE está liberada.",
        interactiveButtons: actionButtons(
          "✅ Código do CRV novo guardado. A saída RENAVE está liberada.",
          [{
            action: "saida",
            placa: pendingInvoice.placa,
            title: "📤 Dar saída",
          }],
        ),
      };
    }
    const key = input.userText.replace(/\D/g, "");
    if (!validateNfeKey(key)) {
      return {
        handled: true,
        reply:
          "A chave da NF-e é inválida. Envie os 44 dígitos com o dígito verificador correto.",
      };
    }
    const invoice = await callLogged(caller, {
      ambiente: "hom",
      operacao: "enviarNotaFiscal",
      params: {},
      body: {
        chaveNotaFiscal: key,
        evento: "COMPRA",
        idEstoque: pendingInvoice.idEstoque,
      },
    });
    if (invoice.status < 200 || invoice.status >= 300) {
      return { handled: true, reply: errorMessage(invoice) };
    }
    const response = await callLogged(caller, {
      ambiente: "hom",
      operacao: "crlve",
      params: {
        placaVeiculo: pendingInvoice.placa,
        renavamVeiculo: pendingInvoice.renavam,
      },
    });
    if (response.status < 200 || response.status >= 300) {
      await input.saveAgentStatePatch({
        pending_renave_nota: null,
        renave_veiculos: updatedVehicleContexts(
          input.agentState,
          pendingInvoice.placa,
          { nf_entrada_enviada: true },
        ),
      }, input.agentState);
      return {
        handled: true,
        reply: `✅ NF-e de entrada enviada. O CRLV-e ainda não foi liberado: ${
          errorMessage(response)
        }`,
      };
    }
    const pdf = crlvPdf(response.body);
    if (!pdf) {
      return {
        handled: true,
        reply:
          "✅ NF-e enviada, mas o Serpro não retornou o PDF do CRLV-e. Tente novamente.",
      };
    }
    const code = await extractCrlvSecurityCode(pdf);
    const current = record(
      vehicleContexts(input.agentState)[pendingInvoice.placa],
    );
    let sensitive: RenaveSensitiveState = {
      documentoProprietario: "",
      codigoSegurancaCrv: code ?? "",
    };
    const encrypted = stringValue(current.sensivel_cifrado);
    if (encrypted) {
      try {
        sensitive = {
          ...(await decryptRenaveSensitiveState(encrypted)),
          codigoSegurancaCrv: code ?? "",
        };
      } catch {
        // Replace an invalid stale vehicle secret.
      }
    }
    await input.saveAgentStatePatch({
      pending_renave_nota: code ? null : {
        ...pendingInvoice,
        phase: "codigo_crv",
        expires_at: nextExpiry(now),
      },
      renave_veiculos: updatedVehicleContexts(
        input.agentState,
        pendingInvoice.placa,
        {
          nf_entrada_enviada: true,
          crv_novo_disponivel: Boolean(code),
          sensivel_cifrado: await encryptRenaveSensitiveState(sensitive),
        },
      ),
    }, input.agentState);
    const document: RenaveDocument = {
      filename: `crlv-e-${pendingInvoice.placa}.pdf`,
      caption: "CRLV-e",
      base64: pdf,
    };
    if (!code) {
      return {
        handled: true,
        reply:
          "✅ NF-e enviada e CRLV-e recebido. Não consegui extrair o código: informe os 11 dígitos do CRV novo.",
        documents: [document],
      };
    }
    const reply =
      "✅ NF-e enviada, CRLV-e recebido e código do CRV novo guardado.";
    return {
      handled: true,
      reply,
      documents: [document],
      interactiveButtons: actionButtons(reply, [{
        action: "saida",
        placa: pendingInvoice.placa,
        title: "📤 Dar saída",
      }]),
    };
  }
  if (pendingExit) {
    if (
      isRenaveAction(interactive, "saida_cancelar", pendingExit.placa) ||
      /^cancelar\b/i.test(input.userText.trim()) ||
      isGestaoNegative(input.userText)
    ) {
      await input.saveAgentStatePatch(clearExitPatch(), input.agentState);
      await recordRenaveMovement({
        sb: input.sb,
        userId: input.userId,
        fromNumber: input.fromNumber,
        origem: pendingExit.origem_pedido ?? origem,
        mensagemId: pendingExit.mensagem_pedido_id ?? input.mensagemId,
        mensagemConfirmacaoId: input.mensagemId,
        tipo: "cancelamento",
        placa: pendingExit.placa,
        statusHttp: 200,
        idEstoque: pendingExit.idEstoque,
      });
      return { handled: true, reply: "Saída RENAVE cancelada." };
    }

    if (
      pendingExit.phase === "confirm" &&
      isRenaveAction(interactive, "saida_corrigir", pendingExit.placa)
    ) {
      const next = {
        ...pendingExit,
        phase: "corrigir" as const,
        expires_at: nextExpiry(now),
      };
      await input.saveAgentStatePatch(
        { pending_renave_saida: next },
        input.agentState,
      );
      const list = correctionList("saida", pendingExit.placa);
      return { handled: true, reply: list.body, interactiveList: list };
    }

    if (pendingExit.phase === "corrigir") {
      const field = interactive?.match(
        /^saida_corrigir_(documento|nome|cep|numero|valor|data):[A-Z0-9]{7}$/,
      )?.[1] as
        | "documento"
        | "nome"
        | "cep"
        | "numero"
        | "valor"
        | "data"
        | undefined;
      if (!field || !pendingExit.sensivel_cifrado) {
        const list = correctionList("saida", pendingExit.placa);
        return { handled: true, reply: list.body, interactiveList: list };
      }
      const sensitive = await decryptRenaveSensitiveState(
        pendingExit.sensivel_cifrado,
      );
      const buyer = { ...(sensitive.comprador ?? {}) };
      if (field === "nome") buyer.nome = undefined;
      if (field === "cep") {
        buyer.cep = undefined;
        buyer.logradouro = undefined;
        buyer.bairro = undefined;
        buyer.cidade = undefined;
        buyer.uf = undefined;
      }
      if (field === "numero") buyer.numero = undefined;
      const encrypted = await encryptRenaveSensitiveState({
        ...sensitive,
        ...(field === "documento" ? { documentoProprietario: "" } : {}),
        comprador: buyer,
      });
      const next: PendingRenaveExit = {
        ...pendingExit,
        phase: field,
        sensivel_cifrado: encrypted,
        ...(field === "valor" ? { valorVenda: undefined } : {}),
        ...(field === "data" ? { dataVenda: undefined } : {}),
        ...(field === "cep" ? { codigoMunicipio: undefined } : {}),
        expires_at: nextExpiry(now),
      };
      await input.saveAgentStatePatch(
        { pending_renave_saida: next },
        input.agentState,
      );
      if (field === "data") {
        const buttons = dateButtons("saida", pendingExit.placa);
        return {
          handled: true,
          reply: buttons.body,
          interactiveButtons: buttons,
        };
      }
      const questions: Record<string, string> = {
        documento: "Qual o CPF/CNPJ do comprador?",
        nome: "Qual o nome do comprador?",
        cep: "Qual o CEP do comprador?",
        numero: "Qual o número do endereço?",
        valor: "Qual o valor da venda?",
      };
      return { handled: true, reply: questions[field] };
    }

    if (
      [
        "operador_cpf",
        "email_estabelecimento",
        "documento",
        "nome",
        "email_comprador",
        "cep",
        "logradouro",
        "bairro",
        "cidade",
        "numero",
        "codigo_crv",
        "valor",
        "data",
        "data_custom",
      ].includes(pendingExit.phase)
    ) {
      if (!pendingExit.sensivel_cifrado) {
        await input.saveAgentStatePatch(clearExitPatch(), input.agentState);
        return {
          handled: true,
          reply: "Os dados protegidos da saída expiraram. Recomece o fluxo.",
        };
      }
      let sensitive = await decryptRenaveSensitiveState(
        pendingExit.sensivel_cifrado,
      );
      const buyer = { ...(sensitive.comprador ?? {}) };
      let next: PendingRenaveExit = { ...pendingExit };
      const all = parseExitDetails(input.userText, now);
      if (all) {
        sensitive = {
          ...sensitive,
          documentoProprietario: all.documento,
          codigoSegurancaCrv: all.codigoSegurancaCrv ||
            sensitive.codigoSegurancaCrv,
          comprador: {
            nome: all.nome,
            cep: all.cep,
            logradouro: all.logradouro,
            numero: all.numero,
            bairro: all.bairro,
            cidade: all.cidade,
            uf: all.uf,
          },
        };
        next.valorVenda = all.valorVenda;
        next.dataVenda = all.dataVenda;
      } else {
        const documentRaw = input.userText.match(/[\d./-]{11,18}/)?.[0]
          ?.replace(/\D/g, "");
        const cepRaw = input.userText.match(/\b\d{5}-?\d{3}\b/)?.[0]
          ?.replace(/\D/g, "");
        const rawDate = dateCandidate(input.userText);
        let date = rawDate ? parseRenaveDate(rawDate, now) : null;
        if (isRenaveAction(interactive, "saida_data_hoje", pendingExit.placa)) {
          date = parseRenaveDate("hoje", now);
        } else if (
          isRenaveAction(interactive, "saida_data_ontem", pendingExit.placa)
        ) {
          date = parseRenaveDate("ontem", now);
        } else if (
          isRenaveAction(interactive, "saida_data_outra", pendingExit.placa)
        ) {
          next.phase = "data_custom";
          next.expires_at = nextExpiry(now);
          await input.saveAgentStatePatch(
            { pending_renave_saida: next },
            input.agentState,
          );
          return {
            handled: true,
            reply: "Digite a data. Exemplo: 06/11/2026.",
          };
        }
        if (pendingExit.phase === "operador_cpf") {
          const cpf = input.userText.replace(/\D/g, "");
          if (validCpf(cpf)) {
            sensitive.cpfOperadorResponsavel = cpf;
            await saveOperatorProfile(input, {
              ...(await operatorProfile(input.agentState)),
              cpfOperadorResponsavel: cpf,
            });
          }
        } else if (pendingExit.phase === "email_estabelecimento") {
          const email = input.userText.trim().toLowerCase();
          if (validEmail(email)) {
            sensitive.emailEstabelecimento = email;
            await saveOperatorProfile(input, {
              ...(await operatorProfile(input.agentState)),
              emailEstabelecimento: email,
            });
          }
        } else if (
          pendingExit.phase === "documento" &&
          documentRaw &&
          validateCpfCnpj(documentRaw)
        ) {
          sensitive.documentoProprietario = documentRaw;
        } else if (pendingExit.phase === "nome") {
          buyer.nome = input.userText.trim().slice(0, 80);
        } else if (pendingExit.phase === "email_comprador") {
          const skipped = isRenaveAction(
            interactive,
            "saida_email_pular",
            pendingExit.placa,
          );
          const email = input.userText.trim().toLowerCase();
          if (skipped) buyer.email = "";
          else if (validEmail(email)) buyer.email = email;
        } else if (pendingExit.phase === "cep" && cepRaw) {
          buyer.cep = cepRaw;
          const address =
            await (input.dependencies?.fetchViaCep ?? fetchViaCep)(
              cepRaw,
            );
          if (address) {
            buyer.logradouro = address.logradouro || undefined;
            buyer.bairro = address.bairro || undefined;
            buyer.cidade = address.localidade || undefined;
            buyer.uf = address.uf || undefined;
          }
        } else if (pendingExit.phase === "logradouro") {
          buyer.logradouro = input.userText.trim().slice(0, 100);
        } else if (pendingExit.phase === "bairro") {
          buyer.bairro = input.userText.trim().slice(0, 60);
        } else if (pendingExit.phase === "cidade") {
          const city = input.userText.match(
            /^\s*([^/\n,]{2,60})\s*\/\s*([A-Z]{2})\s*$/i,
          );
          if (city) {
            buyer.cidade = city[1].trim();
            buyer.uf = city[2].toUpperCase();
          }
        } else if (pendingExit.phase === "numero") {
          const number = input.userText.trim();
          if (number && number.length <= 10) buyer.numero = number;
        } else if (pendingExit.phase === "codigo_crv") {
          const code = input.userText.match(/\b\d{11}\b/)?.[0];
          if (code) sensitive.codigoSegurancaCrv = code;
        } else if (pendingExit.phase === "valor") {
          next.valorVenda = labeledMoney(input.userText) ??
            parseRenaveMoney(input.userText) ?? undefined;
        } else if (
          pendingExit.phase === "data" ||
          pendingExit.phase === "data_custom"
        ) {
          next.dataVenda = date ?? undefined;
        }
        sensitive.comprador = buyer;
      }

      const validCurrent = pendingExit.phase === "documento"
        ? Boolean(validateCpfCnpj(sensitive.documentoProprietario))
        : pendingExit.phase === "operador_cpf"
        ? validCpf(sensitive.cpfOperadorResponsavel ?? "")
        : pendingExit.phase === "email_estabelecimento"
        ? validEmail(sensitive.emailEstabelecimento ?? "")
        : pendingExit.phase === "nome"
        ? Boolean(sensitive.comprador?.nome)
        : pendingExit.phase === "email_comprador"
        ? sensitive.comprador?.email !== undefined
        : pendingExit.phase === "cep"
        ? /^\d{8}$/.test(String(sensitive.comprador?.cep ?? ""))
        : pendingExit.phase === "logradouro"
        ? Boolean(sensitive.comprador?.logradouro)
        : pendingExit.phase === "bairro"
        ? Boolean(sensitive.comprador?.bairro)
        : pendingExit.phase === "cidade"
        ? Boolean(sensitive.comprador?.cidade && sensitive.comprador?.uf)
        : pendingExit.phase === "numero"
        ? Boolean(sensitive.comprador?.numero)
        : pendingExit.phase === "codigo_crv"
        ? /^\d{11}$/.test(sensitive.codigoSegurancaCrv)
        : pendingExit.phase === "valor"
        ? Boolean(next.valorVenda)
        : pendingExit.phase === "data" ||
            pendingExit.phase === "data_custom"
        ? Boolean(next.dataVenda)
        : true;
      if (!validCurrent && !all) {
        const field = pendingExit.phase;
        const retry = retryCount(next.tentativas, field);
        next.tentativas = retry.attempts;
        next.sensivel_cifrado = await encryptRenaveSensitiveState(sensitive);
        next.expires_at = nextExpiry(now);
        await input.saveAgentStatePatch(
          { pending_renave_saida: next },
          input.agentState,
        );
        const prompts: Record<string, [string, string]> = {
          operador_cpf: [
            "Qual o seu CPF? Ele vai como operador responsável no RENAVE.",
            "52998224725",
          ],
          email_estabelecimento: [
            "Qual o e-mail do estabelecimento?",
            "loja@exemplo.com.br",
          ],
          documento: ["Qual o CPF/CNPJ do comprador?", "CPF 52998224725"],
          nome: ["Qual o nome do comprador?", "João Silva"],
          email_comprador: [
            "Qual o e-mail do comprador? Você também pode pular.",
            "comprador@exemplo.com.br",
          ],
          cep: ["Qual o CEP do comprador?", "20040020"],
          logradouro: ["Qual a rua do comprador?", "Avenida Rio Branco"],
          bairro: ["Qual o bairro?", "Centro"],
          cidade: ["Qual a cidade/UF?", "Rio de Janeiro/RJ"],
          numero: ["Qual o número do endereço?", "10"],
          codigo_crv: [
            "Qual o código de segurança do CRV?",
            "12345678901",
          ],
          valor: ["Qual o valor da venda?", "R$ 60.000,00"],
          data: [
            dateCandidate(input.userText)
              ? "Essa data é inválida ou futura. Informe uma data válida."
              : "Qual a data da venda?",
            "hoje ou 06/11/2026",
          ],
          data_custom: [
            "Essa data é inválida ou futura. Informe uma data válida.",
            "06/11/2026",
          ],
        };
        const prompt = prompts[field] ??
          ["Revise esse dado.", "Tente novamente"];
        return {
          handled: true,
          ...retryReply(
            prompt[0],
            prompt[1],
            retry.count,
            "saida",
            pendingExit.placa,
          ),
        };
      }

      next.sensivel_cifrado = await encryptRenaveSensitiveState(sensitive);
      const completeBuyer = sensitive.comprador ?? {};
      next.phase = !validCpf(sensitive.cpfOperadorResponsavel ?? "")
        ? "operador_cpf"
        : !validEmail(sensitive.emailEstabelecimento ?? "")
        ? "email_estabelecimento"
        : !validateCpfCnpj(sensitive.documentoProprietario)
        ? "documento"
        : !completeBuyer.nome
        ? "nome"
        : completeBuyer.email === undefined
        ? "email_comprador"
        : !completeBuyer.cep
        ? "cep"
        : !completeBuyer.logradouro
        ? "logradouro"
        : !completeBuyer.bairro
        ? "bairro"
        : !completeBuyer.cidade || !completeBuyer.uf
        ? "cidade"
        : !completeBuyer.numero
        ? "numero"
        : !/^\d{11}$/.test(sensitive.codigoSegurancaCrv)
        ? "codigo_crv"
        : !next.valorVenda
        ? "valor"
        : !next.dataVenda
        ? "data"
        : "municipio";
      next.expires_at = nextExpiry(now);

      if (next.phase === "municipio") {
        const cities = await callLogged(caller, {
          ambiente: "hom",
          operacao: "municipios",
          params: {
            nome: completeBuyer.cidade,
            uf: completeBuyer.uf,
          },
        });
        if (cities.status < 200 || cities.status >= 300) {
          return { handled: true, reply: errorMessage(cities) };
        }
        const options = municipalityOptions(
          cities.body,
          String(completeBuyer.cidade),
          String(completeBuyer.uf),
        );
        if (!options.length) {
          next.phase = "cidade";
          await input.saveAgentStatePatch(
            { pending_renave_saida: next },
            input.agentState,
          );
          return {
            handled: true,
            reply:
              "Não encontrei esse município. Informe novamente como Cidade/UF.",
          };
        }
        if (options.length > 1) {
          next.municipios = options.slice(0, 8);
          await input.saveAgentStatePatch(
            { pending_renave_saida: next },
            input.agentState,
          );
          return {
            handled: true,
            reply: [
              "Encontrei mais de um município. Responda com o número:",
              ...options.slice(0, 8).map((option, index) =>
                `${index + 1}. ${option.nome}/${option.uf}`
              ),
            ].join("\n"),
          };
        }
        next.phase = "confirm";
        next.codigoMunicipio = options[0].id;
        next.municipios = undefined;
      }
      await input.saveAgentStatePatch(
        { pending_renave_saida: next },
        input.agentState,
      );
      const questions: Partial<Record<PendingRenaveExit["phase"], string>> = {
        operador_cpf:
          "Qual o seu CPF? Ele vai como operador responsável no RENAVE.",
        email_estabelecimento: "Qual o e-mail do estabelecimento?",
        documento: "Qual o CPF/CNPJ do comprador?",
        nome: "Qual o nome do comprador?",
        cep: "Qual o CEP do comprador?",
        logradouro: "Qual a rua do comprador?",
        bairro: "Qual o bairro?",
        cidade: "Qual a cidade/UF?",
        numero: "Qual o número do endereço?",
        codigo_crv: "Qual o código de segurança do CRV?",
        valor: "Qual o valor da venda?",
      };
      if (next.phase === "data") {
        const buttons = dateButtons("saida", next.placa);
        return {
          handled: true,
          reply: buttons.body,
          interactiveButtons: buttons,
        };
      }
      if (next.phase === "email_comprador") {
        const reply = "Qual o e-mail do comprador?";
        return {
          handled: true,
          reply,
          interactiveButtons: actionButtons(reply, [{
            action: "saida_email_pular",
            placa: next.placa,
            title: "Pular",
          }]),
        };
      }
      if (next.phase !== "confirm") {
        return {
          handled: true,
          reply: questions[next.phase] ?? "Informe o próximo dado.",
        };
      }
      const reply = [
        "Confirma a saída no RENAVE?",
        `Placa: ${next.placa}`,
        `Comprador: ${sensitive.comprador?.nome}`,
        `Município: ${sensitive.comprador?.cidade}/${sensitive.comprador?.uf}`,
        `Valor: ${formatMoney(next.valorVenda)}`,
        `Data da venda: ${next.dataVenda}`,
      ].join("\n");
      return {
        handled: true,
        reply,
        interactiveButtons: confirmationButtons(
          reply,
          "saida",
          next.placa,
        ),
      };
    }

    if (pendingExit.phase === "dados") {
      const details = parseExitDetails(input.userText, now);
      if (!details) {
        return {
          handled: true,
          reply: exitPrompt(Boolean(pendingExit.sensivel_cifrado)),
        };
      }
      let storedCode = "";
      const context = record(
        vehicleContexts(input.agentState)[pendingExit.placa],
      );
      const contextSecret = stringValue(
        context.sensivel_cifrado || pendingExit.sensivel_cifrado,
      );
      if (contextSecret) {
        try {
          storedCode = (await decryptRenaveSensitiveState(contextSecret))
            .codigoSegurancaCrv;
        } catch {
          storedCode = "";
        }
      }
      const codigoSegurancaCrv = details.codigoSegurancaCrv || storedCode;
      if (!/^\d{11}$/.test(codigoSegurancaCrv)) {
        return { handled: true, reply: exitPrompt(false) };
      }
      const cities = await callLogged(caller, {
        ambiente: "hom",
        operacao: "municipios",
        params: { nome: details.cidade, uf: details.uf },
      });
      if (cities.status < 200 || cities.status >= 300) {
        return { handled: true, reply: errorMessage(cities) };
      }
      const options = municipalityOptions(
        cities.body,
        details.cidade,
        details.uf,
      );
      if (!options.length) {
        return {
          handled: true,
          reply:
            "Não encontrei esse município. Revise cidade/UF e envie todos os dados novamente.",
        };
      }
      const encrypted = await encryptRenaveSensitiveState({
        documentoProprietario: details.documento,
        codigoSegurancaCrv,
        comprador: {
          nome: details.nome,
          cep: details.cep,
          logradouro: details.logradouro,
          numero: details.numero,
          bairro: details.bairro,
        },
      });
      const next: PendingRenaveExit = {
        ...pendingExit,
        phase: options.length === 1 ? "confirm" : "municipio",
        codigoMunicipio: options.length === 1 ? options[0].id : undefined,
        valorVenda: details.valorVenda,
        dataVenda: details.dataVenda,
        sensivel_cifrado: encrypted,
        municipios: options.length === 1 ? undefined : options.slice(0, 8),
        expires_at: nextExpiry(now),
      };
      await input.saveAgentStatePatch(
        { pending_renave_saida: next },
        input.agentState,
      );
      if (next.phase === "municipio") {
        return {
          handled: true,
          reply: [
            "Encontrei mais de um município. Responda com o número:",
            ...options.slice(0, 8).map((option, index) =>
              `${index + 1}. ${option.nome}/${option.uf}`
            ),
          ].join("\n"),
        };
      }
      const reply = [
        "Confirma a saída no RENAVE?",
        `Placa: ${next.placa}`,
        `Comprador: ${details.nome}`,
        `Município: ${options[0].nome}/${options[0].uf}`,
        `Valor: ${formatMoney(next.valorVenda!)}`,
        `Data da venda: ${next.dataVenda}`,
      ].join("\n");
      return {
        handled: true,
        reply,
        interactiveButtons: confirmationButtons(
          reply,
          "saida",
          next.placa,
        ),
      };
    }

    if (pendingExit.phase === "municipio") {
      const choice = Number(input.userText.trim());
      const option = pendingExit.municipios?.[choice - 1];
      if (!Number.isSafeInteger(choice) || !option) {
        return {
          handled: true,
          reply: "Responda com o número de uma das opções de município.",
        };
      }
      const next: PendingRenaveExit = {
        ...pendingExit,
        phase: "confirm",
        codigoMunicipio: option.id,
        municipios: undefined,
        expires_at: nextExpiry(now),
      };
      await input.saveAgentStatePatch(
        { pending_renave_saida: next },
        input.agentState,
      );
      const buyer = next.sensivel_cifrado
        ? (await decryptRenaveSensitiveState(next.sensivel_cifrado)).comprador
        : null;
      if (!buyer) {
        await input.saveAgentStatePatch(clearExitPatch(), input.agentState);
        return {
          handled: true,
          reply:
            "Os dados protegidos da saída são inválidos. Recomece o fluxo.",
        };
      }
      const reply = [
        "Confirma a saída no RENAVE?",
        `Placa: ${next.placa}`,
        `Comprador: ${buyer.nome}`,
        `Município: ${option.nome}/${option.uf}`,
        `Valor: ${formatMoney(next.valorVenda!)}`,
        `Data da venda: ${next.dataVenda}`,
      ].join("\n");
      return {
        handled: true,
        reply,
        interactiveButtons: confirmationButtons(
          reply,
          "saida",
          next.placa,
        ),
      };
    }

    if (
      !isRenaveAction(interactive, "saida_confirmar", pendingExit.placa) &&
      !/^(?:confirmar|sim)\b/i.test(input.userText.trim())
    ) {
      return {
        handled: true,
        reply: "Toque em *Confirmar*, *Corrigir* ou *Cancelar*.",
        interactiveButtons: confirmationButtons(
          "Toque em *Confirmar*, *Corrigir* ou *Cancelar*.",
          "saida",
          pendingExit.placa,
        ),
      };
    }
    if (
      !pendingExit.codigoMunicipio ||
      !pendingExit.valorVenda ||
      !pendingExit.dataVenda ||
      !pendingExit.sensivel_cifrado
    ) {
      await input.saveAgentStatePatch(clearExitPatch(), input.agentState);
      return {
        handled: true,
        reply: "Os dados da saída expiraram. Envie o comando novamente.",
      };
    }
    const sensitive = await decryptRenaveSensitiveState(
      pendingExit.sensivel_cifrado,
    );
    const documentType = validateCpfCnpj(sensitive.documentoProprietario);
    const buyer = sensitive.comprador;
    if (
      !documentType ||
      !/^\d{11}$/.test(sensitive.codigoSegurancaCrv) ||
      !validCpf(sensitive.cpfOperadorResponsavel ?? "") ||
      !validEmail(sensitive.emailEstabelecimento ?? "") ||
      !buyer?.nome ||
      !buyer.cep ||
      !buyer.logradouro ||
      !buyer.numero ||
      !buyer.bairro
    ) {
      await input.saveAgentStatePatch(clearExitPatch(), input.agentState);
      return {
        handled: true,
        reply: "Os dados protegidos da saída são inválidos. Recomece o fluxo.",
      };
    }
    let result: RenaveResponse;
    try {
      result = await callLogged(caller, {
        ambiente: "hom",
        operacao: "solicitarSaidaEstoque",
        params: {},
        body: {
          cpfOperadorResponsavel: sensitive.cpfOperadorResponsavel,
          dataVenda: pendingExit.dataVenda,
          emailEstabelecimento: sensitive.emailEstabelecimento,
          valorVenda: pendingExit.valorVenda,
          comprador: {
            numeroDocumento: sensitive.documentoProprietario,
            tipoDocumento: documentType,
            nome: buyer.nome,
            ...(buyer.email ? { email: buyer.email } : {}),
            endereco: {
              cep: buyer.cep,
              codigoMunicipio: pendingExit.codigoMunicipio,
              logradouro: buyer.logradouro,
              numero: buyer.numero,
              bairro: buyer.bairro,
            },
          },
          veiculo: {
            placa: pendingExit.placa,
            renavam: pendingExit.renavam,
            ...(pendingExit.numeroCrv
              ? { numeroCrv: pendingExit.numeroCrv }
              : {}),
            codigoSegurancaCrv: sensitive.codigoSegurancaCrv,
          },
        },
      });
    } catch {
      await recordRenaveMovement({
        sb: input.sb,
        userId: input.userId,
        fromNumber: input.fromNumber,
        origem: pendingExit.origem_pedido ?? origem,
        mensagemId: pendingExit.mensagem_pedido_id ?? input.mensagemId,
        mensagemConfirmacaoId: input.mensagemId,
        tipo: "saida",
        placa: pendingExit.placa,
        statusHttp: 0,
        idEstoque: pendingExit.idEstoque,
        valor: pendingExit.valorVenda,
        dataOperacao: pendingExit.dataVenda,
      });
      return {
        handled: true,
        reply: "O RENAVE está indisponível agora. Tente novamente.",
      };
    } finally {
      await input.saveAgentStatePatch(clearExitPatch(), input.agentState);
    }
    await recordRenaveMovement({
      sb: input.sb,
      userId: input.userId,
      fromNumber: input.fromNumber,
      origem: pendingExit.origem_pedido ?? origem,
      mensagemId: pendingExit.mensagem_pedido_id ?? input.mensagemId,
      mensagemConfirmacaoId: input.mensagemId,
      tipo: "saida",
      placa: pendingExit.placa,
      statusHttp: result.status,
      idEstoque: pendingExit.idEstoque,
      estadoEstoque: stringValue(record(result.body).estado) || null,
      valor: pendingExit.valorVenda,
      dataOperacao: pendingExit.dataVenda,
    });
    if (result.status < 200 || result.status >= 300) {
      return { handled: true, reply: errorMessage(result) };
    }
    await input.saveAgentStatePatch({
      renave_veiculos: updatedVehicleContexts(
        input.agentState,
        pendingExit.placa,
        {
          sensivel_cifrado: null,
          estado: stringValue(record(result.body).estado) || "SOLICITADO_SAIDA",
        },
      ),
    }, input.agentState);
    const documents = await fetchRenaveDocuments(caller, {
      placa: pendingExit.placa,
      renavam: pendingExit.renavam,
      idEstoque: pendingExit.idEstoque,
    });
    const reply = [
      "✅ Saída solicitada no RENAVE.",
      `Estado: ${stringValue(record(result.body).estado) || "SOLICITADO"}`,
      "ATPV-e e termo de saída disponíveis foram enviados.",
    ].join("\n");
    return {
      handled: true,
      reply,
      interactiveButtons: actionButtons(reply, [
        {
          action: "documentos",
          placa: pendingExit.placa,
          title: "📄 Documentos",
        },
        { action: "estoque", title: "📋 Estoque" },
      ]),
      documents,
    };
  }

  if (pending) {
    if (
      isRenaveAction(interactive, "entrada_cancelar", pending.placa) ||
      /^cancelar\b/i.test(input.userText.trim()) ||
      isGestaoNegative(input.userText)
    ) {
      await input.saveAgentStatePatch(
        clearSensitivePatch(input.agentState),
        input.agentState,
      );
      await recordRenaveMovement({
        sb: input.sb,
        userId: input.userId,
        fromNumber: input.fromNumber,
        origem: pending.origem_pedido ?? origem,
        mensagemId: pending.mensagem_pedido_id ?? input.mensagemId,
        mensagemConfirmacaoId: input.mensagemId,
        tipo: "cancelamento",
        placa: pending.placa,
        statusHttp: 200,
      });
      return { handled: true, reply: "Entrada RENAVE cancelada." };
    }

    if (pending.phase === "crv") {
      const crv = parseCrvDetails(input.userText);
      if (!crv) return { handled: true, reply: crvPrompt() };
      const aptitude = await runAptitude(caller, {
        placa: pending.placa,
        ...crv,
      });
      if (!aptitude.ok || !aptitude.apto) {
        await input.saveAgentStatePatch(
          { pending_renave_entrada: null },
          input.agentState,
        );
        return { handled: true, reply: aptitude.reply };
      }
      const sensitive = await applyOperatorProfile(input, {
        documentoProprietario: "",
        codigoSegurancaCrv: crv.codigoSegurancaCrv,
      });
      const next: PendingRenaveEntry = {
        phase: "operador_cpf",
        placa: pending.placa,
        origem_pedido: pending.origem_pedido,
        mensagem_pedido_id: pending.mensagem_pedido_id,
        renavam: crv.renavam,
        numeroCrv: crv.numeroCrv,
        tipoCrv: crv.tipoCrv,
        sensivel_cifrado: "",
        expires_at: nextExpiry(now),
      };
      next.phase = entryNextPhase(next, sensitive);
      next.sensivel_cifrado = await encryptRenaveSensitiveState(sensitive);
      await input.saveAgentStatePatch(
        { pending_renave_entrada: next },
        input.agentState,
      );
      return {
        handled: true,
        reply: `${aptitude.reply}\n\n${entryPhasePrompt(next.phase)}`,
      };
    }

    if (
      pending.phase === "confirm" &&
      isRenaveAction(interactive, "entrada_corrigir", pending.placa)
    ) {
      const next = {
        ...pending,
        phase: "corrigir" as const,
        expires_at: nextExpiry(now),
      };
      await input.saveAgentStatePatch(
        { pending_renave_entrada: next },
        input.agentState,
      );
      const list = correctionList("entrada", pending.placa);
      return { handled: true, reply: list.body, interactiveList: list };
    }

    if (pending.phase === "corrigir") {
      const field = interactive?.match(
        /^entrada_corrigir_(km|valor|data):[A-Z0-9]{7}$/,
      )?.[1] as "km" | "valor" | "data" | undefined;
      if (!field) {
        const list = correctionList("entrada", pending.placa);
        return { handled: true, reply: list.body, interactiveList: list };
      }
      const next: PendingRenaveEntry = {
        ...pending,
        phase: field,
        ...(field === "km" ? { quilometragem: undefined } : {}),
        ...(field === "valor" ? { valorCompra: undefined } : {}),
        ...(field === "data" ? { dataCompra: undefined } : {}),
        expires_at: nextExpiry(now),
      };
      await input.saveAgentStatePatch(
        { pending_renave_entrada: next },
        input.agentState,
      );
      if (field === "data") {
        const buttons = dateButtons("entrada", pending.placa);
        return {
          handled: true,
          reply: buttons.body,
          interactiveButtons: buttons,
        };
      }
      return {
        handled: true,
        reply: field === "km" ? "Qual a km atual?" : "Qual o valor da compra?",
      };
    }

    if (
      [
        "compra",
        "operador_cpf",
        "email_estabelecimento",
        "email_vendedor",
        "km",
        "valor",
        "data",
        "data_custom",
        "proprietario",
      ].includes(pending.phase)
    ) {
      if (!pending.sensivel_cifrado) {
        return { handled: true, reply: crvPrompt() };
      }
      let sensitive = await decryptRenaveSensitiveState(
        pending.sensivel_cifrado,
      );
      let next: PendingRenaveEntry = { ...pending };
      if (pending.phase === "operador_cpf") {
        const cpf = input.userText.replace(/\D/g, "");
        if (!validCpf(cpf)) {
          return {
            handled: true,
            reply: "CPF inválido. Informe o CPF do operador responsável.",
          };
        }
        sensitive = { ...sensitive, cpfOperadorResponsavel: cpf };
        await saveOperatorProfile(input, {
          ...(await operatorProfile(input.agentState)),
          cpfOperadorResponsavel: cpf,
        });
      } else if (pending.phase === "email_estabelecimento") {
        const email = input.userText.trim().toLowerCase();
        if (!validEmail(email)) {
          return {
            handled: true,
            reply: "E-mail inválido. Informe o e-mail do estabelecimento.",
          };
        }
        sensitive = { ...sensitive, emailEstabelecimento: email };
        await saveOperatorProfile(input, {
          ...(await operatorProfile(input.agentState)),
          emailEstabelecimento: email,
        });
      } else if (pending.phase === "email_vendedor") {
        const email = input.userText.trim().toLowerCase();
        if (!validEmail(email)) {
          return {
            handled: true,
            reply: "E-mail inválido. Informe o e-mail do vendedor.",
          };
        }
        sensitive = { ...sensitive, emailVendedor: email };
      }
      next.sensivel_cifrado = await encryptRenaveSensitiveState(sensitive);
      const purchase = parsePurchaseDetails(input.userText, now);
      const km = purchase?.quilometragem ?? labeledKm(input.userText) ??
        (pending.phase === "km" ? parseRenaveKm(input.userText) : null);
      const money = purchase?.valorCompra ?? labeledMoney(input.userText) ??
        (pending.phase === "valor" ? parseRenaveMoney(input.userText) : null);
      const rawDate = dateCandidate(input.userText);
      let date = purchase?.dataCompra ??
        (rawDate ? parseRenaveDate(rawDate, now) : null);
      if (isRenaveAction(interactive, "entrada_data_hoje", pending.placa)) {
        date = parseRenaveDate("hoje", now);
      } else if (
        isRenaveAction(interactive, "entrada_data_ontem", pending.placa)
      ) {
        date = parseRenaveDate("ontem", now);
      } else if (
        isRenaveAction(interactive, "entrada_data_outra", pending.placa)
      ) {
        next.phase = "data_custom";
        next.expires_at = nextExpiry(now);
        await input.saveAgentStatePatch(
          { pending_renave_entrada: next },
          input.agentState,
        );
        return {
          handled: true,
          reply: "Digite a data. Exemplo: 06/11/2026.",
        };
      }
      const documentRaw = input.userText.match(
        /\b(?:cpf|cnpj|documento)\s*[:=-]?\s*([\d./-]{11,18})\b/i,
      )?.[1] ?? (pending.phase === "proprietario"
        ? input.userText.match(/[\d./-]{11,18}/)?.[0]
        : undefined);
      const document = documentRaw?.replace(/\D/g, "");
      if (km != null) next.quilometragem = km;
      if (money != null) next.valorCompra = money;
      if (date) next.dataCompra = date;
      if (document && validateCpfCnpj(document)) {
        next.sensivel_cifrado = await encryptRenaveSensitiveState({
          ...sensitive,
          documentoProprietario: document,
        });
      }

      const invalidField = pending.phase === "km" && km == null
        ? ["km", "Qual a km atual?", "45000 ou 45 mil"]
        : pending.phase === "valor" && money == null
        ? ["valor", "Qual o valor da compra?", "60000 ou R$ 60.000,00"]
        : (pending.phase === "data" || pending.phase === "data_custom") &&
            !date &&
            !isRenaveAction(interactive, "entrada_data_outra", pending.placa)
        ? [
          "data",
          rawDate
            ? "Essa data é inválida ou futura. Informe uma data válida."
            : "Qual a data da compra?",
          "hoje ou 06/11/2026",
        ]
        : pending.phase === "proprietario" &&
            (!document || !validateCpfCnpj(document))
        ? [
          "proprietario",
          "Qual o CPF/CNPJ do proprietário atual?",
          "CPF 52998224725",
        ]
        : null;
      if (invalidField) {
        const retry = retryCount(next.tentativas, invalidField[0]);
        next.tentativas = retry.attempts;
        next.expires_at = nextExpiry(now);
        await input.saveAgentStatePatch(
          { pending_renave_entrada: next },
          input.agentState,
        );
        return {
          handled: true,
          ...retryReply(
            invalidField[1],
            invalidField[2],
            retry.count,
            "entrada",
            pending.placa,
          ),
        };
      }

      const updatedSensitive = await decryptRenaveSensitiveState(
        next.sensivel_cifrado!,
      );
      next.phase = entryNextPhase(next, updatedSensitive);
      next.expires_at = nextExpiry(now);
      await input.saveAgentStatePatch(
        { pending_renave_entrada: next },
        input.agentState,
      );
      if (
        next.phase === "operador_cpf" ||
        next.phase === "email_estabelecimento" ||
        next.phase === "email_vendedor" ||
        next.phase === "km" ||
        next.phase === "valor"
      ) return { handled: true, reply: entryPhasePrompt(next.phase) };
      if (next.phase === "data") {
        const buttons = dateButtons("entrada", next.placa);
        return {
          handled: true,
          reply: buttons.body,
          interactiveButtons: buttons,
        };
      }
      if (next.phase === "proprietario") {
        return { handled: true, reply: entryPhasePrompt(next.phase) };
      }
      const reply = [
        "Confirma a entrada no RENAVE?",
        `Placa: ${next.placa}`,
        `Km: ${next.quilometragem}`,
        `Valor: ${formatMoney(next.valorCompra)}`,
        `Data da compra: ${next.dataCompra}`,
      ].join("\n");
      return {
        handled: true,
        reply,
        interactiveButtons: confirmationButtons(
          reply,
          "entrada",
          next.placa,
        ),
      };
    }

    if (
      !isRenaveAction(interactive, "entrada_confirmar", pending.placa) &&
      !/^(?:confirmar|sim)\b/i.test(input.userText.trim())
    ) {
      const reply = "Toque em *Confirmar*, *Corrigir* ou *Cancelar*.";
      return {
        handled: true,
        reply,
        interactiveButtons: confirmationButtons(
          reply,
          "entrada",
          pending.placa,
        ),
      };
    }

    if (
      !pending.sensivel_cifrado ||
      !pending.renavam ||
      !pending.numeroCrv ||
      !pending.tipoCrv ||
      pending.quilometragem == null ||
      pending.valorCompra == null ||
      !pending.dataCompra
    ) {
      await input.saveAgentStatePatch(
        clearSensitivePatch(input.agentState),
        input.agentState,
      );
      return {
        handled: true,
        reply: "Os dados da entrada expiraram. Envie o comando novamente.",
      };
    }
    const sensitive = await decryptRenaveSensitiveState(
      pending.sensivel_cifrado,
    );
    const documentType = validateCpfCnpj(sensitive.documentoProprietario);
    if (
      !documentType ||
      !/^\d{11}$/.test(sensitive.codigoSegurancaCrv) ||
      !validCpf(sensitive.cpfOperadorResponsavel ?? "") ||
      !validEmail(sensitive.emailEstabelecimento ?? "") ||
      !validEmail(sensitive.emailVendedor ?? "")
    ) {
      await input.saveAgentStatePatch(
        clearSensitivePatch(input.agentState),
        input.agentState,
      );
      return {
        handled: true,
        reply:
          "Os dados protegidos da entrada são inválidos. Inicie novamente.",
      };
    }
    let result: RenaveResponse;
    try {
      result = await callLogged(caller, {
        ambiente: "hom",
        operacao: "solicitarEntradaEstoque",
        params: {},
        body: {
          cpfOperadorResponsavel: sensitive.cpfOperadorResponsavel,
          dataCompra: pending.dataCompra,
          emailEstabelecimento: sensitive.emailEstabelecimento,
          emailVendedor: sensitive.emailVendedor,
          valorCompra: pending.valorCompra,
          veiculo: {
            placa: pending.placa,
            renavam: pending.renavam,
            numeroCrv: pending.numeroCrv,
            codigoSegurancaCrv: sensitive.codigoSegurancaCrv,
            tipoCrv: pending.tipoCrv,
            quilometragemHodometro: pending.quilometragem,
            dataHoraMedicaoHodometro: saoPauloDateTime(now),
            documentoProprietarioAtual: sensitive.documentoProprietario,
            tipoDocumentoProprietarioAtual: documentType,
          },
        },
      });
    } catch {
      await recordRenaveMovement({
        sb: input.sb,
        userId: input.userId,
        fromNumber: input.fromNumber,
        origem: pending.origem_pedido ?? origem,
        mensagemId: pending.mensagem_pedido_id ?? input.mensagemId,
        mensagemConfirmacaoId: input.mensagemId,
        tipo: "entrada",
        placa: pending.placa,
        statusHttp: 0,
        valor: pending.valorCompra,
        dataOperacao: pending.dataCompra,
      });
      return {
        handled: true,
        reply: "O RENAVE está indisponível agora. Tente novamente.",
      };
    } finally {
      await input.saveAgentStatePatch(
        clearSensitivePatch(input.agentState),
        input.agentState,
      );
    }
    const responseBody = record(result.body);
    const idEstoque = Number(
      responseBody.idEstoque ?? responseBody.id ?? responseBody.codigo,
    );
    const validStockId = Number.isSafeInteger(idEstoque) && idEstoque > 0
      ? idEstoque
      : null;
    await recordRenaveMovement({
      sb: input.sb,
      userId: input.userId,
      fromNumber: input.fromNumber,
      origem: pending.origem_pedido ?? origem,
      mensagemId: pending.mensagem_pedido_id ?? input.mensagemId,
      mensagemConfirmacaoId: input.mensagemId,
      tipo: "entrada",
      placa: pending.placa,
      statusHttp: result.status,
      idEstoque: validStockId,
      estadoEstoque: stringValue(responseBody.estado) || null,
      valor: pending.valorCompra,
      dataOperacao: pending.dataCompra,
    });
    if (result.status < 200 || result.status >= 300) {
      return { handled: true, reply: errorMessage(result) };
    }
    let documents: RenaveDocument[] = [];
    if (validStockId && pending.renavam) {
      let base64: string | null = null;
      try {
        const terms = await callLogged(caller, {
          ambiente: "hom",
          operacao: "termoEntrada",
          params: { idEstoque: validStockId },
        });
        base64 = terms.status >= 200 && terms.status < 300
          ? safePdf(record(terms.body).pdfBase64)
          : null;
      } catch {
        base64 = null;
      }
      if (base64) {
        documents = [{
          filename: `termo-entrada-${pending.placa}.pdf`,
          caption: "Termo de entrada RENAVE",
          base64,
        }];
      }
      await input.saveAgentStatePatch({
        renave_veiculos: updatedVehicleContexts(
          input.agentState,
          pending.placa,
          {
            placa: pending.placa,
            renavam: pending.renavam,
            numeroCrv: pending.numeroCrv,
            idEstoque: validStockId,
            estado: stringValue(responseBody.estado) || "SOLICITADO",
            nf_entrada_enviada: false,
            crv_novo_disponivel: false,
          },
        ),
      }, input.agentState);
    }
    const reply = [
      "✅ Entrada solicitada no RENAVE.",
      `Estoque: ${validStockId ?? "não informado"}`,
      `Estado: ${stringValue(responseBody.estado) || "SOLICITADO"}`,
      "Próximo passo: confirmar a transferência no Detran.",
    ].join("\n");
    return {
      handled: true,
      reply,
      interactiveButtons: actionButtons(reply, [
        {
          action: "detran",
          placa: pending.placa,
          title: "🏛️ Simular Detran",
        },
        {
          action: "documentos",
          placa: pending.placa,
          title: "📄 Documentos",
        },
        { action: "estoque", title: "📋 Estoque" },
      ]),
      documents,
    };
  }

  if (!command) return { handled: false };

  if (command.kind === "teste") {
    const documento = input.dependencies?.mockCpf?.() ?? generateValidCpf();
    const authenticated = await callLogged(caller, {
      ambiente: "hom",
      operacao: "clienteAutenticado",
      params: {},
    });
    const uf = authenticated.status >= 200 && authenticated.status < 300
      ? authenticatedClientUf(authenticated.body)
      : "SP";
    const result = await callLogged(caller, {
      ambiente: "hom",
      operacao: "mockVeiculoUsado",
      params: {},
      body: {
        ufJurisdicaoVeiculo: uf,
        sufixoPlaca: input.dependencies?.mockSuffix?.() ??
          generateRenaveMockSuffix(),
        comRouboFurto: false,
        jaBaixado: false,
        documentoProprietario: documento,
        nomeProprietario: "PROPRIETARIO TESTE",
      },
    });
    if (result.status < 200 || result.status >= 300) {
      return { handled: true, reply: errorMessage(result) };
    }
    const body = record(result.body);
    const placa = normalizeBrazilianPlate(body.placa);
    const renavam = stringValue(body.renavam);
    const numeroCrv = stringValue(body.numeroCrv);
    const codigoSegurancaCrv = stringValue(body.codigoSegurancaCrv);
    if (
      !placa ||
      !/^\d{11}$/.test(renavam) ||
      !/^\d{12}$/.test(numeroCrv) ||
      !/^\d{11}$/.test(codigoSegurancaCrv)
    ) {
      return {
        handled: true,
        reply: "O Serpro criou um mock incompleto. Tente novamente.",
      };
    }
    const encrypted = await encryptRenaveSensitiveState(
      await applyOperatorProfile(input, {
        documentoProprietario: documento,
        codigoSegurancaCrv,
        emailVendedor: "vendedor.teste@amzofertas.com.br",
      }),
    );
    const mock: RenaveMockState = {
      ambiente: "hom",
      placa,
      renavam,
      numeroCrv,
      tipoCrv: MOCK_TYPE,
      sensivel_cifrado: encrypted,
      created_at: now.toISOString(),
    };
    await input.saveAgentStatePatch(
      { renave_mock_ultimo: mock },
      input.agentState,
    );
    const reply = [
      "✅ Veículo de teste criado no Serpro.",
      `Placa: ${placa}`,
      `RENAVAM: ${renavam}`,
      `Número do CRV: ${numeroCrv}`,
    ].join("\n");
    return {
      handled: true,
      reply,
      interactiveButtons: actionButtons(reply, [
        { action: "aptidao", placa, title: "🔎 Consultar aptidão" },
        { action: "entrada", placa, title: "📥 Dar entrada" },
      ]),
    };
  }

  if (command.kind === "estoque") {
    const result = await callLogged(caller, {
      ambiente: "hom",
      operacao: "consultarEstoques",
      params: {},
    });
    if (result.status < 200 || result.status >= 300) {
      return { handled: true, reply: errorMessage(result) };
    }
    const rows = Array.isArray(result.body) ? result.body.slice(0, 10) : [];
    if (!rows.length) {
      return { handled: true, reply: "Nenhum veículo no estoque RENAVE." };
    }
    return {
      handled: true,
      reply: [
        "🚘 Estoque RENAVE",
        ...rows.map((item) => {
          const row = record(item);
          const entrada = record(row.entradaEstoque);
          return `${stringValue(row.placa) || "Sem placa"} · ${
            stringValue(row.estado) || "sem estado"
          } · ${
            stringValue(entrada.dataHoraRegistro) ||
            stringValue(entrada.dataHora) ||
            "sem data"
          }`;
        }),
      ].join("\n"),
    };
  }

  if (command.kind === "detran") {
    let result: RenaveResponse;
    try {
      result = await callLogged(caller, {
        ambiente: "hom",
        operacao: "mockTransferenciaDetran",
        params: {},
        body: { placa: command.placa },
      });
    } catch {
      await recordRenaveMovement({
        sb: input.sb,
        userId: input.userId,
        fromNumber: input.fromNumber,
        origem: commandOrigin,
        mensagemId: commandMessageId,
        tipo: "detran_simulado",
        placa: command.placa,
        statusHttp: 0,
      });
      return {
        handled: true,
        reply: "O RENAVE está indisponível agora. Tente novamente.",
      };
    }
    let stock: Record<string, unknown> | null = null;
    const resultBody = record(result.body);
    let idEstoque = Number(
      resultBody.idEstoque ??
        resultBody.id ??
        record(vehicleContexts(input.agentState)[command.placa]).idEstoque,
    );
    if (result.status >= 200 && result.status < 300) {
      if (!Number.isSafeInteger(idEstoque) || idEstoque <= 0) {
        const lookup = await findStockByPlate(caller, command.placa);
        stock = lookup.stock;
        idEstoque = Number(stock?.id ?? stock?.idEstoque);
      }
      if (Number.isSafeInteger(idEstoque) && idEstoque > 0) {
        const detail = await callLogged(caller, {
          ambiente: "hom",
          operacao: "consultarEstoquePorId",
          params: { id: idEstoque },
        });
        if (detail.status >= 200 && detail.status < 300) {
          stock = record(detail.body);
        }
      }
    }
    const validStockId = Number.isSafeInteger(idEstoque) && idEstoque > 0
      ? idEstoque
      : null;
    const estado = stringValue(stock?.estado) || "CONFIRMADO";
    if (result.status >= 200 && result.status < 300) {
      await input.saveAgentStatePatch({
        renave_veiculos: updatedVehicleContexts(
          input.agentState,
          command.placa,
          {
            placa: command.placa,
            renavam: stringValue(stock?.renavam ?? resultBody.renavam),
            numeroCrv: stringValue(stock?.numeroCrv ?? resultBody.numeroCrv),
            idEstoque: validStockId,
            estado,
          },
        ),
      }, input.agentState);
    }
    await recordRenaveMovement({
      sb: input.sb,
      userId: input.userId,
      fromNumber: input.fromNumber,
      origem: commandOrigin,
      mensagemId: commandMessageId,
      tipo: "detran_simulado",
      placa: command.placa,
      statusHttp: result.status,
      idEstoque: validStockId,
      estadoEstoque: estado,
    });
    if (result.status < 200 || result.status >= 300) {
      return { handled: true, reply: errorMessage(result) };
    }
    const reply =
      `✅ Detran confirmou a transferência (simulação de homologação).\nEstado: ${estado}`;
    return {
      handled: true,
      reply,
      interactiveButtons: actionButtons(reply, [
        {
          action: "nota",
          placa: command.placa,
          title: "📄 Enviar NF entrada",
        },
        { action: "estoque", title: "📋 Estoque" },
      ]),
    };
  }

  if (command.kind === "nota") {
    const context = record(vehicleContexts(input.agentState)[command.placa]);
    let idEstoque = Number(context.idEstoque);
    let renavam = stringValue(context.renavam);
    if (
      !Number.isSafeInteger(idEstoque) ||
      idEstoque <= 0 ||
      !/^\d{11}$/.test(renavam)
    ) {
      const lookup = await findStockByPlate(caller, command.placa);
      if (
        lookup.response.status < 200 ||
        lookup.response.status >= 300
      ) {
        return { handled: true, reply: errorMessage(lookup.response) };
      }
      if (!lookup.stock) {
        return {
          handled: true,
          reply: "Esse veículo não está no estoque RENAVE da loja.",
        };
      }
      idEstoque = Number(lookup.stock.id ?? lookup.stock.idEstoque);
      renavam = stringValue(lookup.stock.renavam);
    }
    if (
      !Number.isSafeInteger(idEstoque) ||
      idEstoque <= 0 ||
      !/^\d{11}$/.test(renavam)
    ) {
      return {
        handled: true,
        reply: "O estoque retornou dados incompletos para enviar a NF-e.",
      };
    }
    const pending: PendingRenaveInvoice = {
      phase: "chave",
      placa: command.placa,
      renavam,
      idEstoque,
      origem_pedido: commandOrigin,
      mensagem_pedido_id: commandMessageId,
      expires_at: nextExpiry(now),
    };
    await input.saveAgentStatePatch(
      { pending_renave_nota: pending },
      input.agentState,
    );
    return {
      handled: true,
      reply: "Informe a chave da NF-e de entrada com 44 dígitos.",
    };
  }

  if (command.kind === "saida") {
    const lookup = await findStockByPlate(caller, command.placa);
    if (
      lookup.response.status < 200 ||
      lookup.response.status >= 300
    ) {
      return { handled: true, reply: errorMessage(lookup.response) };
    }
    if (!lookup.stock) {
      return {
        handled: true,
        reply: "Esse veículo não está no estoque RENAVE da loja.",
      };
    }
    const estado = normalizeText(stringValue(lookup.stock.estado));
    if (!estado.includes("confirmado")) {
      return {
        handled: true,
        reply: `O veículo ainda não está CONFIRMADO no estoque (estado atual: ${
          stringValue(lookup.stock.estado) || "não informado"
        }).`,
      };
    }
    const idEstoque = Number(
      lookup.stock.id ?? lookup.stock.idEstoque,
    );
    const renavam = stringValue(lookup.stock.renavam);
    if (
      !Number.isSafeInteger(idEstoque) ||
      idEstoque <= 0 ||
      !/^\d{11}$/.test(renavam)
    ) {
      return {
        handled: true,
        reply:
          "O estoque retornou dados incompletos. Consulte o veículo novamente.",
      };
    }
    const context = record(vehicleContexts(input.agentState)[command.placa]);
    let codigoSegurancaCrv = "";
    const contextSecret = stringValue(context.sensivel_cifrado);
    if (contextSecret) {
      try {
        codigoSegurancaCrv = (await decryptRenaveSensitiveState(contextSecret))
          .codigoSegurancaCrv;
      } catch {
        codigoSegurancaCrv = "";
      }
    }
    if (
      context.nf_entrada_enviada !== true ||
      context.crv_novo_disponivel !== true ||
      !/^\d{11}$/.test(codigoSegurancaCrv)
    ) {
      const reply =
        "Antes da saída, envie a NF-e de entrada para obter o CRLV-e e o código do CRV novo.";
      return {
        handled: true,
        reply,
        interactiveButtons: actionButtons(reply, [{
          action: "nota",
          placa: command.placa,
          title: "📄 Enviar NF entrada",
        }]),
      };
    }
    const exitSensitive = await applyOperatorProfile(input, {
      documentoProprietario: "",
      codigoSegurancaCrv,
      comprador: {},
    });
    const sensitive = await encryptRenaveSensitiveState(exitSensitive);
    const pending: PendingRenaveExit = {
      phase: !validCpf(exitSensitive.cpfOperadorResponsavel ?? "")
        ? "operador_cpf"
        : !validEmail(exitSensitive.emailEstabelecimento ?? "")
        ? "email_estabelecimento"
        : "documento",
      placa: command.placa,
      origem_pedido: commandOrigin,
      mensagem_pedido_id: commandMessageId,
      idEstoque,
      renavam,
      numeroCrv: stringValue(lookup.stock.numeroCrv) || undefined,
      sensivel_cifrado: sensitive,
      expires_at: nextExpiry(now),
    };
    await input.saveAgentStatePatch(
      { pending_renave_saida: pending },
      input.agentState,
    );
    return {
      handled: true,
      reply: pending.phase === "operador_cpf"
        ? "Qual o seu CPF? Ele vai como operador responsável no RENAVE."
        : pending.phase === "email_estabelecimento"
        ? "Qual o e-mail do estabelecimento?"
        : "Qual o CPF/CNPJ do comprador?",
    };
  }

  if (command.kind === "documentos") {
    const lookup = await findStockByPlate(caller, command.placa);
    if (
      lookup.response.status < 200 ||
      lookup.response.status >= 300
    ) {
      return { handled: true, reply: errorMessage(lookup.response) };
    }
    if (!lookup.stock) {
      return {
        handled: true,
        reply: "Esse veículo não está no estoque RENAVE da loja.",
      };
    }
    const idEstoque = Number(
      lookup.stock.id ?? lookup.stock.idEstoque,
    );
    const renavam = stringValue(lookup.stock.renavam);
    if (
      !Number.isSafeInteger(idEstoque) ||
      idEstoque <= 0 ||
      !/^\d{11}$/.test(renavam)
    ) {
      return {
        handled: true,
        reply:
          "O estoque retornou dados incompletos para buscar os documentos.",
      };
    }
    const documents = await fetchRenaveDocuments(caller, {
      placa: command.placa,
      renavam,
      idEstoque,
    });
    return {
      handled: true,
      reply: documents.length
        ? `Enviei ${documents.length} documento(s) disponível(is) do RENAVE.`
        : "Nenhum documento RENAVE está disponível para esse veículo.",
      documents,
    };
  }

  const mock = mockFromState(
    input.agentState.renave_mock_ultimo,
    command.placa,
  );
  if (command.kind === "aptidao") {
    const inline = parseAptitudeIdentifiers(command.text);
    const renavam = mock?.renavam ?? inline?.renavam;
    const numeroCrv = mock?.numeroCrv ?? inline?.numeroCrv;
    const tipoCrv = mock?.tipoCrv ?? inline?.tipoCrv ?? MOCK_TYPE;
    if (!renavam || !numeroCrv) {
      return {
        handled: true,
        reply:
          "Para consultar esse veículo, informe RENAVAM e número do CRV. Exemplo: renave aptidão ABC1D23 renavam 12345678901 crv 123456789012.",
      };
    }
    const aptitude = await runAptitude(caller, {
      placa: command.placa,
      renavam,
      numeroCrv,
      tipoCrv,
    });
    return {
      handled: true,
      reply: aptitude.reply,
      ...(aptitude.ok && aptitude.apto
        ? {
          interactiveButtons: actionButtons(aptitude.reply, [
            {
              action: "entrada",
              placa: command.placa,
              title: "📥 Dar entrada",
            },
            {
              action: "cancelar",
              placa: command.placa,
              title: "❌ Cancelar",
            },
          ]),
        }
        : {}),
    };
  }

  if (mock?.sensivel_cifrado) {
    const aptitude = await runAptitude(caller, {
      placa: command.placa,
      renavam: mock.renavam,
      numeroCrv: mock.numeroCrv,
      tipoCrv: mock.tipoCrv,
    });
    if (!aptitude.ok) {
      return { handled: true, reply: aptitude.reply };
    }
    if (!aptitude.apto) {
      await input.saveAgentStatePatch(
        clearSensitivePatch(input.agentState),
        input.agentState,
      );
      return { handled: true, reply: aptitude.reply };
    }
    const sensitive = await applyOperatorProfile(
      input,
      await decryptRenaveSensitiveState(mock.sensivel_cifrado),
    );
    const next: PendingRenaveEntry = {
      phase: "operador_cpf",
      placa: mock.placa,
      origem_pedido: commandOrigin,
      mensagem_pedido_id: commandMessageId,
      renavam: mock.renavam,
      numeroCrv: mock.numeroCrv,
      tipoCrv: mock.tipoCrv,
      sensivel_cifrado: "",
      expires_at: nextExpiry(now),
    };
    next.phase = entryNextPhase(next, sensitive);
    next.sensivel_cifrado = await encryptRenaveSensitiveState(sensitive);
    await input.saveAgentStatePatch(
      {
        pending_renave_entrada: next,
        renave_mock_ultimo: { ...mock, sensivel_cifrado: null },
      },
      input.agentState,
    );
    return {
      handled: true,
      reply: `${aptitude.reply}\n\n${entryPhasePrompt(next.phase)}`,
    };
  }

  const next: PendingRenaveEntry = {
    phase: "crv",
    placa: command.placa,
    origem_pedido: commandOrigin,
    mensagem_pedido_id: commandMessageId,
    expires_at: nextExpiry(now),
  };
  await input.saveAgentStatePatch(
    { pending_renave_entrada: next },
    input.agentState,
  );
  return { handled: true, reply: crvPrompt() };
}
