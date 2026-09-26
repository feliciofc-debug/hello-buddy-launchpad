export const DEMO_LIMIT_MESSAGE =
  "Essa foi a demonstração gratuita. Para criar mais e publicar nas suas redes, o Felicio te mostra a plataforma completa. Quer que eu peça pra ele te chamar?";

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
