/** Recados ao dono da vitrine (sem UUIDs internos; sem PII sensível). */

export type VitrineRecadoKind =
  | "interesse"
  | "consultor"
  | "visita"
  | "financiamento"
  | "financiamento_ficha"
  | "troca"
  | "fluxo_cancelado";

const RECADO_META: Record<
  VitrineRecadoKind,
  { emoji: string; titulo: string; acao: string }
> = {
  interesse: {
    emoji: "💬",
    titulo: "Novo interesse",
    acao: "Retornar o contato do cliente.",
  },
  consultor: {
    emoji: "👤",
    titulo: "Falar com consultor",
    acao: "Retornar o contato do cliente.",
  },
  visita: {
    emoji: "📅",
    titulo: "Visita / test drive",
    acao: "Confirmar horário com o cliente.",
  },
  financiamento: {
    emoji: "💳",
    titulo: "Simular financiamento",
    acao: "Retornar contato com simulação.",
  },
  financiamento_ficha: {
    emoji: "💳",
    titulo: "Nova ficha de financiamento",
    acao: "Analisar simulação e retornar contato.",
  },
  troca: {
    emoji: "🔄",
    titulo: "Avaliação na troca",
    acao: "Avaliar e retornar contato ao cliente.",
  },
  fluxo_cancelado: {
    emoji: "⚠️",
    titulo: "Cliente saiu do fluxo",
    acao: "Retomar contato se fizer sentido.",
  },
};

export function resolveAppPublicBaseUrl(envUrl?: string | null): string {
  const raw = String(
    envUrl ?? (typeof Deno !== "undefined" ? Deno.env.get("APP_URL") : "") ??
      "https://www.amzofertas.com.br",
  ).trim().replace(/\/+$/, "");
  return raw || "https://www.amzofertas.com.br";
}

export function buildFinanciamentoFichaPanelUrl(
  fichaId: string,
  envUrl?: string | null,
): string {
  const base = resolveAppPublicBaseUrl(envUrl);
  return `${base}/veiculos/financiamento/${encodeURIComponent(fichaId)}`;
}

export function formatRecadoWhatsAppPhone(fromNumber: string): string {
  const d = String(fromNumber || "").replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    if (rest.length === 9) {
      return `55 ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
    if (rest.length === 8) {
      return `55 ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
  }
  return String(fromNumber || "").trim();
}

export function buildVitrineRecadoHeader(
  kind: VitrineRecadoKind,
  input: {
    clienteNome: string;
    contactName?: string | null;
    fromNumber: string;
  },
): string {
  const meta = RECADO_META[kind];
  const perfil = String(input.contactName || "").trim() || "—";
  const phone = formatRecadoWhatsAppPhone(input.fromNumber);
  return `${meta.emoji} *${meta.titulo}* — Cliente: ${input.clienteNome} (perfil: ${perfil}) · ${phone}`;
}

export function buildVitrineRecadoAcao(kind: VitrineRecadoKind): string {
  return `➡️ ${RECADO_META[kind].acao}`;
}

/** Linhas proibidas em recados (IDs internos). */
export function recadoContainsInternalIds(text: string): boolean {
  const t = String(text || "");
  if (/Veículo \(estoque\):/i.test(t)) return true;
  if (/Ficha \(painel\):/i.test(t)) return true;
  if (/\(id [0-9a-f-]{36}\)/i.test(t)) return true;
  if (/\bid [0-9a-f-]{36}\b/i.test(t)) return true;
  return false;
}
