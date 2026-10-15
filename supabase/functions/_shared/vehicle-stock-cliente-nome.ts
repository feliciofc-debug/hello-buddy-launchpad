import type {
  PendingVitrineEstoque,
  VitrineEstoqueForm,
  VitrineVisitaTurno,
} from "./vehicle-stock-whatsapp.ts";
import { formatRecadoWhatsAppPhone } from "./vehicle-stock-vitrine-recado.ts";

export const VITRINE_CLIENTE_NOME_PROMPT =
  "Perfeito! Para eu passar ao nosso consultor, como posso te chamar? 😊";

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
  return String(text || "")
    .replace(/^🎙️\s*Áudio transcrito:\s*/i, "")
    .replace(/<<INTERACTIVE_ID:[^>]+>>/gi, "")
    .trim()
    .slice(0, 120);
}

export function isClienteNomeForm(
  form: VitrineEstoqueForm | null | undefined,
): form is VitrineEstoqueForm & { flow: "cliente_nome"; resume: VitrineRecadoResume } {
  return form?.flow === "cliente_nome" && form.step === "nome" && !!form.resume;
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
