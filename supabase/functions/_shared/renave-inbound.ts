import type { GestaoAuthContext } from "./gestao-auth-phone.ts";
import { isGestaoNegative } from "./gestao-intent-pt.ts";
import { ownerPhonesEquivalent } from "./owner-phone.ts";
import {
  chamarRenave,
  type RenaveEnvironment,
  type RenaveResponse,
} from "./renave-client.ts";
import {
  decryptRenaveSensitiveState,
  encryptRenaveSensitiveState,
} from "./renave-state-crypto.ts";
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
  phase: "crv" | "compra" | "confirm";
  placa: string;
  renavam?: string;
  numeroCrv?: string;
  tipoCrv?: CrvType;
  quilometragem?: number;
  valorCompra?: number;
  dataCompra?: string;
  sensivel_cifrado?: string;
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
  phase: "dados" | "municipio" | "confirm";
  placa: string;
  idEstoque: number;
  renavam: string;
  numeroCrv?: string;
  codigoMunicipio?: number;
  valorVenda?: number;
  dataVenda?: string;
  sensivel_cifrado?: string;
  municipios?: MunicipioOption[];
  expires_at: string;
};

type CrvType = "AZUL" | "VERDE" | "BRANCO" | "DIGITAL";

export type ParsedRenaveCommand =
  | { kind: "teste" }
  | { kind: "estoque" }
  | { kind: "aptidao"; placa: string; text: string }
  | { kind: "entrada"; placa: string }
  | { kind: "detran"; placa: string }
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
    !["crv", "compra", "confirm"].includes(String(pending.phase)) ||
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
    !["dados", "municipio", "confirm"].includes(String(pending.phase)) ||
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

export function hasPendingRenaveEntry(
  agentState: Record<string, unknown>,
): boolean {
  return Boolean(
    agentState.pending_renave_entrada || agentState.pending_renave_saida,
  );
}

export function parseRenaveCommand(text: string): ParsedRenaveCommand {
  const normalized = normalizeText(text);
  if (!/\brenave\b/.test(normalized)) return null;
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
  const letters = "ABCDEFGHJ";
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
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 99_999_999.99
    ? Math.round(parsed * 100) / 100
    : null;
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
  if (normalizeText(value).trim() === "hoje") return saoPauloDate(now);
  const iso = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const br = value.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  const candidate = iso
    ? `${iso[1]}-${iso[2]}-${iso[3]}`
    : br
    ? `${br[3]}-${br[2]}-${br[1]}`
    : null;
  if (!candidate) return null;
  const parsed = new Date(`${candidate}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === candidate
    ? candidate
    : null;
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
  const kmRaw = text.match(/\b(?:km|quilometragem)\s*[:=-]?\s*([\d.]+)\b/i)
    ?.[1];
  const valueRaw = text.match(
    /\b(?:valor(?:\s+da\s+compra)?|compra)\s*[:=-]?\s*(?:R\$\s*)?([\d.,]+)\b/i,
  )?.[1];
  const dateRaw = text.match(
    /\bdata(?:\s+da\s+compra)?\s*[:=-]?\s*(hoje|\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/i,
  )?.[1];
  const documentRaw = text.match(
    /\b(?:cpf|cnpj|documento)\s*[:=-]?\s*([\d./-]{11,18})\b/i,
  )?.[1];
  const quilometragem = Number(String(kmRaw ?? "").replace(/\D/g, ""));
  const valorCompra = valueRaw ? parseMoney(valueRaw) : null;
  const dataCompra = dateRaw ? parseDate(dateRaw, now) : null;
  if (
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

function formatMoney(value: unknown): string {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
    : "R$ 0,00";
}

const RESTRICTION_LABELS: Record<string, string> = {
  comunicacaoComDetranFalhou: "falha de comunicação com Detran",
  veiculoComRestricaoImpeditivaNoDetran: "restrição no Detran",
  veiculoComRestricaoJudicial: "restrição judicial",
  veiculoComRestricaoNaReceitaFederal: "restrição na RFB",
  veiculoComRestricaoPgfn: "restrição na PGFN",
  veiculoComRouboFurto: "roubo/furto",
  veiculoComRecall: "recall",
  veiculoComAlarme: "alarme",
  veiculoBaixado: "veículo baixado",
};

export function formatAptitude(body: unknown): {
  apto: boolean;
  reply: string;
} {
  const payload = record(body);
  const diagnostic = record(payload.diagnostico);
  const debts = record(payload.informacoesDebitos);
  const apto = diagnostic.veiculoApto === true;
  const restrictions = Object.entries(RESTRICTION_LABELS)
    .filter(([key]) =>
      key === "comunicacaoComDetranFalhou"
        ? payload[key] === true
        : diagnostic[key] === true
    )
    .map(([, label]) => label);
  const reasons = Array.isArray(diagnostic.motivosParaNaoAptidao)
    ? diagnostic.motivosParaNaoAptidao.map(String).filter(Boolean)
    : [];
  const debtLines = [
    ["IPVA", debts.valorDebitoIpva],
    ["Licenciamento", debts.valorDebitoLicenciamento],
    ["Multas", debts.valorDebitoMultas],
  ].filter(([, value]) => Number(value) > 0)
    .map(([label, value]) => `${label}: ${formatMoney(value)}`);
  return {
    apto,
    reply: [
      apto
        ? "✅ Apto para entrada no RENAVE."
        : "❌ Não apto para entrada no RENAVE.",
      ...(reasons.length ? [`Motivos: ${reasons.join("; ")}`] : []),
      ...(restrictions.length
        ? [`Restrições: ${restrictions.join(", ")}`]
        : []),
      ...(debtLines.length ? [`Débitos: ${debtLines.join(" · ")}`] : []),
    ].join("\n"),
  };
}

function errorMessage(result: RenaveResponse): string {
  const body = record(result.body);
  return stringValue(body.mensagemParaUsuarioFinal) ||
    "Não foi possível concluir a operação RENAVE agora.";
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

function confirmationButtons(reply: string): RenaveInteractiveButtons {
  return {
    body: reply,
    buttons: [
      {
        id: `${RENAVE_WA_PREFIX}entrada_confirmar`,
        title: "✅ Confirmar entrada",
      },
      {
        id: `${RENAVE_WA_PREFIX}entrada_cancelar`,
        title: "❌ Cancelar",
      },
    ],
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
    const base64 = safePdf(record(response.body)[request.field]);
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
  };
}): Promise<{
  handled: boolean;
  reply?: string;
  interactiveButtons?: RenaveInteractiveButtons;
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
  const command = parseRenaveCommand(input.userText);
  const interactive = parseInteractiveAction(
    input.interactiveId || input.userText,
  );
  if (!rawPending && !rawExit && !command && !interactive) {
    return { handled: false };
  }

  if (configuredEnvironment() === "prod") {
    if (rawPending || rawExit) {
      await input.saveAgentStatePatch(
        { ...clearSensitivePatch(input.agentState), ...clearExitPatch() },
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

  const caller = input.dependencies?.callRenave ?? chamarRenave as RenaveCaller;
  if (pendingExit) {
    if (
      interactive === "saida_cancelar" ||
      /^cancelar\b/i.test(input.userText.trim()) ||
      isGestaoNegative(input.userText)
    ) {
      await input.saveAgentStatePatch(clearExitPatch(), input.agentState);
      await recordRenaveMovement({
        sb: input.sb,
        userId: input.userId,
        fromNumber: input.fromNumber,
        origem,
        mensagemId: input.mensagemId,
        tipo: "cancelamento",
        placa: pendingExit.placa,
        statusHttp: 200,
        idEstoque: pendingExit.idEstoque,
      });
      return { handled: true, reply: "Saída RENAVE cancelada." };
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
        interactiveButtons: {
          body: reply,
          buttons: [
            { id: "renave_wa:saida_confirmar", title: "✅ Confirmar saída" },
            { id: "renave_wa:saida_cancelar", title: "❌ Cancelar" },
          ],
        },
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
        interactiveButtons: {
          body: reply,
          buttons: [
            { id: "renave_wa:saida_confirmar", title: "✅ Confirmar saída" },
            { id: "renave_wa:saida_cancelar", title: "❌ Cancelar" },
          ],
        },
      };
    }

    if (
      interactive !== "saida_confirmar" &&
      !/^(?:confirmar|sim)\b/i.test(input.userText.trim())
    ) {
      return {
        handled: true,
        reply: "Toque em *Confirmar saída* ou *Cancelar*.",
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
    if (
      !documentType ||
      !/^\d{11}$/.test(sensitive.codigoSegurancaCrv) ||
      !sensitive.comprador
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
          dataVenda: pendingExit.dataVenda,
          valorVenda: pendingExit.valorVenda,
          comprador: {
            numeroDocumento: sensitive.documentoProprietario,
            tipoDocumento: documentType,
            nome: sensitive.comprador.nome,
            endereco: {
              cep: sensitive.comprador.cep,
              codigoMunicipio: pendingExit.codigoMunicipio,
              logradouro: sensitive.comprador.logradouro,
              numero: sensitive.comprador.numero,
              bairro: sensitive.comprador.bairro,
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
        origem,
        mensagemId: input.mensagemId,
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
      origem,
      mensagemId: input.mensagemId,
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
    return {
      handled: true,
      reply: [
        "✅ Saída solicitada no RENAVE.",
        `Estado: ${stringValue(record(result.body).estado) || "SOLICITADO"}`,
        "ATPV-e e termo de saída disponíveis foram enviados.",
      ].join("\n"),
      documents,
    };
  }

  if (pending) {
    if (
      interactive === "entrada_cancelar" ||
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
        origem,
        mensagemId: input.mensagemId,
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
      const encrypted = await encryptRenaveSensitiveState({
        documentoProprietario: "",
        codigoSegurancaCrv: crv.codigoSegurancaCrv,
      });
      const next: PendingRenaveEntry = {
        phase: "compra",
        placa: pending.placa,
        renavam: crv.renavam,
        numeroCrv: crv.numeroCrv,
        tipoCrv: crv.tipoCrv,
        sensivel_cifrado: encrypted,
        expires_at: nextExpiry(now),
      };
      await input.saveAgentStatePatch(
        { pending_renave_entrada: next },
        input.agentState,
      );
      return {
        handled: true,
        reply: `${aptitude.reply}\n\n${purchasePrompt(false)}`,
      };
    }

    if (pending.phase === "compra") {
      const purchase = parsePurchaseDetails(input.userText, now);
      if (!purchase) {
        let hasDocument = false;
        if (pending.sensivel_cifrado) {
          const current = await decryptRenaveSensitiveState(
            pending.sensivel_cifrado,
          );
          hasDocument = Boolean(current.documentoProprietario);
        }
        return { handled: true, reply: purchasePrompt(hasDocument) };
      }
      if (!pending.sensivel_cifrado) {
        return { handled: true, reply: crvPrompt() };
      }
      const sensitive = await decryptRenaveSensitiveState(
        pending.sensivel_cifrado,
      );
      const documento = purchase.documentoProprietario ||
        sensitive.documentoProprietario;
      if (!documento || !validateCpfCnpj(documento)) {
        return { handled: true, reply: purchasePrompt(false) };
      }
      const encrypted = await encryptRenaveSensitiveState({
        documentoProprietario: documento,
        codigoSegurancaCrv: sensitive.codigoSegurancaCrv,
      });
      const next: PendingRenaveEntry = {
        ...pending,
        phase: "confirm",
        quilometragem: purchase.quilometragem,
        valorCompra: purchase.valorCompra,
        dataCompra: purchase.dataCompra,
        sensivel_cifrado: encrypted,
        expires_at: nextExpiry(now),
      };
      await input.saveAgentStatePatch(
        { pending_renave_entrada: next },
        input.agentState,
      );
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
        interactiveButtons: confirmationButtons(reply),
      };
    }

    if (
      interactive !== "entrada_confirmar" &&
      !/^(?:confirmar|sim)\b/i.test(input.userText.trim())
    ) {
      const reply = "Toque em *Confirmar entrada* ou *Cancelar*.";
      return {
        handled: true,
        reply,
        interactiveButtons: confirmationButtons(reply),
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
      !/^\d{11}$/.test(sensitive.codigoSegurancaCrv)
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
          dataCompra: pending.dataCompra,
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
        origem,
        mensagemId: input.mensagemId,
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
      origem,
      mensagemId: input.mensagemId,
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
          },
        ),
      }, input.agentState);
    }
    return {
      handled: true,
      reply: [
        "✅ Entrada solicitada no RENAVE.",
        `Estoque: ${validStockId ?? "não informado"}`,
        `Estado: ${stringValue(responseBody.estado) || "SOLICITADO"}`,
        "Próximo passo: enviar NF-e de entrada — ainda não implementado.",
      ].join("\n"),
      documents,
    };
  }

  if (!command) return { handled: false };

  if (command.kind === "teste") {
    const documento = input.dependencies?.mockCpf?.() ?? generateValidCpf();
    const result = await callLogged(caller, {
      ambiente: "hom",
      operacao: "mockVeiculoUsado",
      params: {},
      body: {
        ufJurisdicaoVeiculo: "RJ",
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
    const encrypted = await encryptRenaveSensitiveState({
      documentoProprietario: documento,
      codigoSegurancaCrv,
    });
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
    return {
      handled: true,
      reply: [
        "✅ Veículo de teste criado no Serpro.",
        `Placa: ${placa}`,
        `RENAVAM: ${renavam}`,
        `Número do CRV: ${numeroCrv}`,
        `Agora envie: renave entrada ${placa}`,
      ].join("\n"),
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
        origem,
        mensagemId: input.mensagemId,
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
    if (result.status >= 200 && result.status < 300) {
      const lookup = await findStockByPlate(caller, command.placa);
      stock = lookup.stock;
    }
    const resultBody = record(result.body);
    const codigoSegurancaCrv = stringValue(
      resultBody.codigoSegurancaCrv ??
        stock?.codigoSegurancaCrv ??
        record(stock?.veiculo).codigoSegurancaCrv,
    );
    const idEstoque = Number(stock?.id ?? stock?.idEstoque);
    const validStockId = Number.isSafeInteger(idEstoque) && idEstoque > 0
      ? idEstoque
      : null;
    const estado = stringValue(stock?.estado) || "CONFIRMADO";
    if (result.status >= 200 && result.status < 300) {
      const sensitive = /^\d{11}$/.test(codigoSegurancaCrv)
        ? await encryptRenaveSensitiveState({
          documentoProprietario: "",
          codigoSegurancaCrv,
        })
        : null;
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
            ...(sensitive ? { sensivel_cifrado: sensitive } : {}),
          },
        ),
      }, input.agentState);
    }
    await recordRenaveMovement({
      sb: input.sb,
      userId: input.userId,
      fromNumber: input.fromNumber,
      origem,
      mensagemId: input.mensagemId,
      tipo: "detran_simulado",
      placa: command.placa,
      statusHttp: result.status,
      idEstoque: validStockId,
      estadoEstoque: estado,
    });
    if (result.status < 200 || result.status >= 300) {
      return { handled: true, reply: errorMessage(result) };
    }
    return {
      handled: true,
      reply:
        "✅ Detran confirmou a transferência (simulação de homologação) — carro CONFIRMADO no estoque.",
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
    const pending: PendingRenaveExit = {
      phase: "dados",
      placa: command.placa,
      idEstoque,
      renavam,
      numeroCrv: stringValue(lookup.stock.numeroCrv) || undefined,
      sensivel_cifrado: stringValue(context.sensivel_cifrado) || undefined,
      expires_at: nextExpiry(now),
    };
    await input.saveAgentStatePatch(
      { pending_renave_saida: pending },
      input.agentState,
    );
    return {
      handled: true,
      reply: exitPrompt(Boolean(pending.sensivel_cifrado)),
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
    return { handled: true, reply: aptitude.reply };
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
    const next: PendingRenaveEntry = {
      phase: "compra",
      placa: mock.placa,
      renavam: mock.renavam,
      numeroCrv: mock.numeroCrv,
      tipoCrv: mock.tipoCrv,
      sensivel_cifrado: mock.sensivel_cifrado,
      expires_at: nextExpiry(now),
    };
    await input.saveAgentStatePatch(
      {
        pending_renave_entrada: next,
        renave_mock_ultimo: { ...mock, sensivel_cifrado: null },
      },
      input.agentState,
    );
    return {
      handled: true,
      reply: `${aptitude.reply}\n\n${purchasePrompt(true)}`,
    };
  }

  const next: PendingRenaveEntry = {
    phase: "crv",
    placa: command.placa,
    expires_at: nextExpiry(now),
  };
  await input.saveAgentStatePatch(
    { pending_renave_entrada: next },
    input.agentState,
  );
  return { handled: true, reply: crvPrompt() };
}
