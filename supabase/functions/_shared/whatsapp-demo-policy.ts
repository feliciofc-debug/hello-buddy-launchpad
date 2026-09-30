import { ownerPhonesEquivalent } from "./owner-phone.ts";

export const DEMO_LIMIT_MESSAGE =
  "A demonstração gratuita deste número já foi usada. Vou reenviar a última mídia; se quiser avançar, o Felicio pode te mostrar a plataforma completa.";

export const TENANT_CREATION_BLOCK_MESSAGE =
  "Esse recurso é exclusivo do responsável da conta. Posso continuar ajudando com suas dúvidas por aqui.";

const CREATION_TOOLS = new Set([
  "gerar_imagem",
  "editar_imagem",
  "criar_anuncio",
  "criar_carrossel",
  "criar_video_animado",
]);

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
    ? `A demonstração gratuita deste número foi feita em ${date}. Vou reenviar a última mídia; se quiser avançar, o Felicio pode te mostrar a plataforma completa.`
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
