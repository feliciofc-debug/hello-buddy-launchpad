import type {
  PendingVitrineEstoque,
  VitrineEstoqueForm,
  VitrineVisitaTurno,
} from "./vehicle-stock-whatsapp.ts";
import { formatRecadoWhatsAppPhone } from "./vehicle-stock-vitrine-recado.ts";
import { stripAudioTranscriptPrefix } from "./vitrine-inbound-text.ts";

export const VITRINE_CLIENTE_NOME_OPCIONAL_PROMPT =
  "Se quiser, me diga como prefere ser chamado(a) — ou siga conversando normalmente 😊";

/** @deprecated fluxo bloqueante; mantido só para testes legados. */
export const VITRINE_CLIENTE_NOME_PROMPT = VITRINE_CLIENTE_NOME_OPCIONAL_PROMPT;

const NON_NAME_BLOCKLIST = new Set([
  "ok",
  "obrigado",
  "obrigada",
  "valeu",
  "sim",
  "nao",
  "não",
  "beleza",
  "show",
  "top",
  "blz",
  "oi",
  "ola",
  "olá",
  "bom dia",
  "boa tarde",
  "boa noite",
  "ver carros",
  "menu",
  "voltar",
  "cancelar",
]);

const NAME_CHARS_RE = /^[\p{L}\s'\u2019-]+$/u;
const EMOJI_ONLY_RE =
  /^[\p{Emoji}\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+$/u;

function normalizeForBlocklist(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Aceita só respostas que parecem nome próprio (form opcional pós-confirmação). */
export function parseOptionalClienteNome(text: string): string | null {
  let parsed = stripAudioTranscriptPrefix(text)
    .replace(/<<INTERACTIVE_ID:[^>]+>>/gi, "")
    .trim();
  if (!parsed || parsed.length < 2 || parsed.length > 40) return null;
  if (EMOJI_ONLY_RE.test(parsed)) return null;
  if (parsed.includes("?")) return null;
  const blockKey = normalizeForBlocklist(parsed);
  if (NON_NAME_BLOCKLIST.has(blockKey)) return null;
  if (/\b(preco|preço|valor|quanto|custa)\b/i.test(blockKey)) return null;
  const words = parsed.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 4) return null;
  if (!NAME_CHARS_RE.test(parsed)) return null;
  return parsed;
}

export type VitrineRecadoResume =
  | { kind: "interesse"; vehicleId: string }
  | { kind: "financiamento"; vehicleId: string }
  | { kind: "consultor"; vehicleId?: string | null }
  | {
    kind: "visita";
    vehicleId: string;
    diaIso: string;
    turno: VitrineVisitaTurno;
  }
  | { kind: "troca_confirm" };

export function vitrineClienteNomeSalvo(
  pending: PendingVitrineEstoque | null | undefined,
): boolean {
  return !!String(pending?.cliente_nome || "").trim();
}

export function vitrineContactNameFallback(
  contactName?: string | null,
): string {
  const n = String(contactName || "").trim();
  return n || "Cliente";
}

export function vitrineNomeParaRecado(input: {
  pending: PendingVitrineEstoque | null | undefined;
  contactName?: string | null;
}): string {
  const saved = String(input.pending?.cliente_nome || "").trim();
  if (saved) return saved;
  return vitrineContactNameFallback(input.contactName);
}

export function formatRecadoClienteLine(input: {
  clienteNome: string;
  contactName?: string | null;
  fromNumber: string;
}): string {
  const perfil = String(input.contactName || "").trim() || "—";
  return `Cliente: ${input.clienteNome} (perfil: ${perfil}) · ${formatRecadoWhatsAppPhone(input.fromNumber)}`;
}

export function sanitizeClienteNomeResposta(text: string): string {
  return stripAudioTranscriptPrefix(text)
    .replace(/<<INTERACTIVE_ID:[^>]+>>/gi, "")
    .trim()
    .slice(0, 120);
}

export function isClienteNomeOpcionalForm(
  form: VitrineEstoqueForm | null | undefined,
): form is VitrineEstoqueForm & { flow: "cliente_nome_opcional"; step: "nome" } {
  return form?.flow === "cliente_nome_opcional" && form.step === "nome";
}

export function isClienteNomeForm(
  form: VitrineEstoqueForm | null | undefined,
): form is VitrineEstoqueForm & { flow: "cliente_nome"; resume: VitrineRecadoResume } {
  return form?.flow === "cliente_nome" && form.step === "nome" && !!form.resume;
}

export function isClienteNomeCaptureForm(
  form: VitrineEstoqueForm | null | undefined,
): boolean {
  return isClienteNomeOpcionalForm(form) || isClienteNomeForm(form);
}

export function vehicleIdForClienteNomeForm(
  resume: VitrineRecadoResume,
): string {
  switch (resume.kind) {
    case "consultor":
      return resume.vehicleId?.trim() || "geral";
    case "troca_confirm":
      return "troca";
    case "interesse":
    case "financiamento":
    case "visita":
      return resume.vehicleId;
  }
}
