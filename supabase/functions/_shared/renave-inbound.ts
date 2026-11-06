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

type CrvType = "AZUL" | "VERDE" | "BRANCO" | "DIGITAL";

export type ParsedRenaveCommand =
  | { kind: "teste" }
  | { kind: "estoque" }
  | { kind: "aptidao"; placa: string; text: string }
  | { kind: "entrada"; placa: string }
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

export function hasPendingRenaveEntry(
  agentState: Record<string, unknown>,
): boolean {
  return Boolean(agentState.pending_renave_entrada);
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
  const clean = value.replace(/[^\d,.-]/g, "");
  if (!clean) return null;
  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean;
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
}> {
  if (input.hasInboundMedia) return { handled: false };
  if (
    !enabledForUser(input.userId) || !onlyOwner(input.fromNumber, input.auth)
  ) {
    return { handled: false };
  }

  const now = input.dependencies?.now?.() ?? new Date();
  const rawPending = input.agentState.pending_renave_entrada;
  const pending = activePending(rawPending, now);
  const command = parseRenaveCommand(input.userText);
  const interactive = parseInteractiveAction(
    input.interactiveId || input.userText,
  );
  if (!rawPending && !command && !interactive) return { handled: false };

  if (configuredEnvironment() === "prod") {
    if (rawPending) {
      await input.saveAgentStatePatch(
        clearSensitivePatch(input.agentState),
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

  const caller = input.dependencies?.callRenave ?? chamarRenave as RenaveCaller;
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
    } finally {
      await input.saveAgentStatePatch(
        clearSensitivePatch(input.agentState),
        input.agentState,
      );
    }
    if (result.status < 200 || result.status >= 300) {
      return { handled: true, reply: errorMessage(result) };
    }
    const responseBody = record(result.body);
    return {
      handled: true,
      reply: [
        "✅ Entrada solicitada no RENAVE.",
        `Estoque: ${stringValue(responseBody.id) || "não informado"}`,
        `Estado: ${stringValue(responseBody.estado) || "SOLICITADO"}`,
        "Próximo passo: enviar NF-e de entrada — ainda não implementado.",
      ].join("\n"),
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
