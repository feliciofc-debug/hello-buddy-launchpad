import { ownerPhonesEquivalent } from "./owner-phone.ts";

export const DEMO_LIMIT_MESSAGE =
  "A demonstração gratuita deste número já foi usada. Vou reenviar a última mídia; se quiser avançar, um consultor da AMZ pode te mostrar a plataforma completa.";

export const TENANT_CREATION_BLOCK_MESSAGE =
  "Esse recurso é exclusivo do responsável da conta. Posso continuar ajudando com suas dúvidas por aqui.";

export const NON_OWNER_CAPABILITY_GUIDANCE =
  "O cliente pode estar perguntando sobre um recurso. Responda a pergunta explicando o recurso com honestidade. Não execute publicação, vídeo ou composição para ele; na demonstração ele só vê exemplos na conversa.";

const CREATION_TOOLS = new Set([
  "gerar_imagem",
  "editar_imagem",
  "criar_anuncio",
  "criar_carrossel",
  "criar_video_animado",
]);

export function isCreativeDemoTool(toolName: string): boolean {
  return CREATION_TOOLS.has(toolName);
}

export function requiredProspectCreativeTool(
  text: string,
  hasSiteUrl = false,
): "gerar_imagem" | "criar_carrossel" | null {
  const normalized = String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (/\b(?:carrossel|carousel)\b/.test(normalized)) return "criar_carrossel";
  const creationVerb = /\b(?:gera|gere|gerar|cria|crie|criar|faz|faca|fazer|refaz|refaca|refazer)\b/;
  const creativeTarget = /\b(?:imagem|arte|foto|logo|logotipo|logomarca|marca)\b/;
  const retryWithBrand = /\b(?:gera|gere|cria|crie|faz|faca|refaz|refaca)\s+(?:isso\s+)?de novo\b.{0,100}\b(?:logo|marca|site)\b/;
  const explicitRequest = /\b(?:quero|queria|gostaria|me mostra|mostra pra mim|quero ver|vamos testar|pode (?:gerar|criar|fazer))\b/;
  const demoOrExample = /\b(?:demonstra(?:cao|r)?|demo|exemplo|mostra(?:r)?|quero ver|ver|testar)\b/;
  const demoTarget = /\b(?:site|logo|marca|imagem|post|arte|demonstra(?:cao)?)\b/;
  const capabilityQuestion = /\?$/.test(normalized)
    && /\b(?:voces?|conseguem?|como funciona|quanto custa|da para|e possivel)\b/.test(normalized)
    && !explicitRequest.test(normalized)
    && !hasSiteUrl;
  if (capabilityQuestion) return null;
  return (
      creationVerb.test(normalized)
      && creativeTarget.test(normalized)
    )
    || retryWithBrand.test(normalized)
    || (demoOrExample.test(normalized) && demoTarget.test(normalized) && explicitRequest.test(normalized))
    || (hasSiteUrl && (creationVerb.test(normalized) || demoOrExample.test(normalized) || explicitRequest.test(normalized)))
    ? "gerar_imagem"
    : null;
}

const CREATIVE_CLAIM = /\b(?:j[aá]\s+)?(?:criei|gerei|fiz)\b.{0,60}\b(?:logo|imagem|arte|post|carrossel|v[ií]deo)\b/i;
const DEMO_HISTORY_OR_LIMIT = /(?:\b(?:demonstra[cç][aã]o|demo|teste|imagem\s+de\s+demonstra[cç][aã]o)\b.{0,160}\b(?:j[aá]\s+foi|gerad[ao]|acima|em cima|limite|direito\s+a|1\s+post|1\s+teste|por empresa|por conta)\b|\b(?:limite|direito\s+a|1\s+post|1\s+teste|por empresa|por conta)\b.{0,80}\b(?:demonstra[cç][aã]o|demo|teste|imagem|post)\b)/i;

export function containsUnsupportedCreativeClaim(text: string): boolean {
  return CREATIVE_CLAIM.test(text) || DEMO_HISTORY_OR_LIMIT.test(text);
}

export function nonOwnerCapabilityGuidance(
  isOwner: boolean,
  shortcutDetected: boolean,
): string | null {
  return !isOwner && shortcutDetected ? NON_OWNER_CAPABILITY_GUIDANCE : null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function anonymizeConsultantName(text: string, namePattern: string): string {
  return text
    .replace(
      new RegExp(`\\b(?:ao|a\\s+o)\\s+${namePattern}\\b`, "gi"),
      "a um consultor da AMZ",
    )
    .replace(
      new RegExp(`\\b(?:pro|para\\s+o|pelo)\\s+${namePattern}\\b`, "gi"),
      "para um consultor da AMZ",
    )
    .replace(
      new RegExp(`\\bo\\s+${namePattern}\\b`, "gi"),
      "um consultor da AMZ",
    )
    .replace(
      new RegExp(`\\b${namePattern}\\b`, "gi"),
      "um consultor da AMZ",
    );
}

function anonymizeAmzConsultant(
  text: string,
  ownerName?: string | null,
): string {
  const configuredNames = [
    String(ownerName || "").trim(),
    String(ownerName || "").trim().split(/\s+/)[0] || "",
  ]
    .filter((name) => name.length >= 3)
    .sort((a, b) => b.length - a.length);
  let anonymized = text;
  for (const name of [...new Set(configuredNames)]) {
    anonymized = anonymizeConsultantName(anonymized, escapeRegex(name));
  }
  return anonymizeConsultantName(anonymized, "fel[ií]cio");
}

export function sanitizeAmzProspectContactDetails(text: string): string {
  const sanitized = text
    .replace(
      /\b(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)\/[^\s<>()]*/gi,
      "",
    )
    .replace(/\+?\d[\d\s().-]{8,}\d/g, (candidate) => {
      const digits = candidate.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15 ? "" : candidate;
    })
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();
  return sanitized ||
    "Posso te ajudar com mais alguma dúvida sobre a plataforma?";
}

export function finalizeAmzNonOwnerText(
  text: string,
  ownerName?: string | null,
): string {
  return sanitizeAmzProspectContactDetails(
    anonymizeAmzConsultant(text, ownerName),
  );
}

export function ownerForwardClientConfirmation(params: {
  isAmzTenant: boolean;
  humanNeeded: boolean;
  explicitForward: boolean;
  ownerName?: string | null;
  protocol: string;
}): string {
  if (params.isAmzTenant) {
    return params.humanNeeded && !params.explicitForward
      ? `Vou confirmar isso com um dos nossos consultores e pedir para ele te retornar. ${params.protocol}`
      : `Certo, já encaminhei para um dos nossos consultores. Ele vai entrar em contato com você. ${params.protocol}`;
  }
  const owner = String(params.ownerName || "").trim().split(/\s+/)[0] ||
    "responsável";
  return params.humanNeeded && !params.explicitForward
    ? `Vou confirmar isso com ${owner} e pedir para ele te retornar. ${params.protocol}`
    : `Certo, já encaminhei para ${owner}. ${params.protocol}`;
}

export function guardProspectCreativeClaims(params: {
  text: string;
  isAmzProspect: boolean;
  creativeToolRan: boolean;
  previousDemoCreatedAt?: string | null;
}): string {
  if (
    !params.isAmzProspect
  ) return params.text;

  const anonymized = finalizeAmzNonOwnerText(params.text);
  if (params.creativeToolRan || !containsUnsupportedCreativeClaim(anonymized)) {
    return anonymized || "Posso te ajudar com mais alguma dúvida sobre a plataforma?";
  }
  const remaining = anonymized
    .split(/(?<=[.!?])\s+|<<SPLIT>>|\n+/)
    .map((part) => part.trim())
    .filter((part) =>
      part
      && !CREATIVE_CLAIM.test(part)
      && !DEMO_HISTORY_OR_LIMIT.test(part)
    )
    .join(" ")
    .trim();
  if (!params.previousDemoCreatedAt) {
    return remaining || "Posso te ajudar com mais alguma dúvida sobre a plataforma?";
  }
  const limit = demoLimitMessage(params.previousDemoCreatedAt);
  return remaining ? `${limit}<<SPLIT>>${remaining}` : limit;
}

const PUBLICATION_TOOLS = new Set([
  "postar_redes_sociais",
  "postar_midia_biblioteca",
  "confirmar_postagem_redes",
  "publicar_linkedin",
  "agendar_post_pendente",
  "remarcar_agendamento_post",
  "cancelar_agendamento_post",
  "revisar_post_pendente",
  "escolher_variante_post",
]);

export type DemoToolDecision =
  | { allowed: true; mode: "owner" | "normal" | "demo" }
  | { allowed: false; reason: "demo_limit" | "demo_restricted" | "tenant_restricted"; message: string };

export function deterministicDemoBlockedResponse(
  toolName: string,
  rawResult: string,
  replayImageUrl?: string,
): { text: string; imageUrl?: string } | null {
  if (!CREATION_TOOLS.has(toolName)) return null;
  try {
    const result = JSON.parse(rawResult);
    if (
      result?.status !== "demonstracao_bloqueada"
      || typeof result?.mensagem !== "string"
    ) return null;
    return {
      text: result.mensagem,
      ...(replayImageUrl ? { imageUrl: replayImageUrl } : {}),
    };
  } catch {
    return null;
  }
}

export function isDemoTestPhone(fromNumber: string, testPhones: unknown): boolean {
  return Array.isArray(testPhones)
    && testPhones.some((phone) => ownerPhonesEquivalent(phone, fromNumber));
}

export function demoLimitMessage(createdAt?: string | null): string {
  const timestamp = createdAt ? new Date(createdAt) : null;
  const valid = timestamp && Number.isFinite(timestamp.getTime());
  const date = valid
    ? new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(timestamp)
    : null;
  return date
    ? `A demonstração gratuita deste número foi feita em ${date}. Vou reenviar a última mídia; se quiser avançar, um consultor da AMZ pode te mostrar a plataforma completa.`
    : DEMO_LIMIT_MESSAGE;
}

export function demoLimitReplay(previous?: {
  midia_url?: string | null;
  created_at?: string | null;
} | null): { message: string; imageUrl?: string } {
  return {
    message: demoLimitMessage(previous?.created_at),
    ...(previous?.midia_url ? { imageUrl: previous.midia_url } : {}),
  };
}

export function decideWhatsAppCreativeTool(params: {
  toolName: string;
  isOwner: boolean;
  isAmzTenant: boolean;
  generatedImages?: number;
  generatedCarousels?: number;
}): DemoToolDecision {
  if (params.isOwner) return { allowed: true, mode: "owner" };
  const creativeOrPublication = CREATION_TOOLS.has(params.toolName) || PUBLICATION_TOOLS.has(params.toolName);
  if (!creativeOrPublication) return { allowed: true, mode: "normal" };

  if (!params.isAmzTenant) {
    return { allowed: false, reason: "tenant_restricted", message: TENANT_CREATION_BLOCK_MESSAGE };
  }
  if (params.toolName === "gerar_imagem") {
    return (params.generatedImages ?? 0) < 1
      ? { allowed: true, mode: "demo" }
      : { allowed: false, reason: "demo_limit", message: DEMO_LIMIT_MESSAGE };
  }
  if (params.toolName === "criar_carrossel") {
    return (params.generatedCarousels ?? 0) < 1
      ? { allowed: true, mode: "demo" }
      : { allowed: false, reason: "demo_limit", message: DEMO_LIMIT_MESSAGE };
  }
  return { allowed: false, reason: "demo_restricted", message: DEMO_LIMIT_MESSAGE };
}
