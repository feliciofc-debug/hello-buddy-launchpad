import { ownerPhonesEquivalent } from "./owner-phone.ts";

export const DEMO_LIMIT_MESSAGE =
  "A demonstração gratuita deste número já foi usada. Vou reenviar a última mídia; se quiser avançar, um consultor da AMZ pode te mostrar a plataforma completa.";

export const TENANT_CREATION_BLOCK_MESSAGE =
  "Esse recurso é exclusivo do responsável da conta. Posso continuar ajudando com suas dúvidas por aqui.";

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

function anonymizeAmzConsultant(text: string): string {
  return text
    .replace(/\b(?:ao|a\s+o)\s+fel[ií]cio\b/gi, "a um consultor da AMZ")
    .replace(/\b(?:pro|para\s+o|pelo)\s+fel[ií]cio\b/gi, "para um consultor da AMZ")
    .replace(/\bo\s+fel[ií]cio\b/gi, "um consultor da AMZ")
    .replace(/\bfel[ií]cio\b/gi, "um consultor da AMZ");
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

  const anonymized = anonymizeAmzConsultant(params.text);
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
