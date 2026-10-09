import type {
  InboundVertical,
  VerticalNamespacedState,
} from "../vertical-router.ts";
import { singlePhotoActionButtons } from "../single-photo-flow.ts";

export const GENERAL_VERTICAL: InboundVertical = "geral";

export function generalState(
  state: VerticalNamespacedState,
): Record<string, unknown> {
  return { ...(state.general ?? {}) };
}

export function generalOwnsRequest(text: string): boolean {
  const normalized = String(text || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(produto|caneca|garrafa|roupa|servico|cenario|fundo|imagem|foto)\b/
    .test(normalized);
}

export function generalSpecialistPrompt(
  segment?: string | null,
  explicitFipe = false,
): string {
  const businessContext = String(segment || "").trim();
  return [
    "ESPECIALISTA GERAL DE PRODUTOS E SERVIÇOS.",
    "Analise a foto atual e use somente fatos informados.",
    "Ferramentas próprias: análise, edição de cenário, post, carrossel premium e anúncio de produto.",
    "Nunca leia anúncio, lote, carrossel ou memória da vertical de veículos.",
    explicitFipe
      ? "Neste turno, a consulta de FIPE foi pedida explicitamente e pode ser usada somente para responder esse pedido."
      : "Não ofereça nem consulte FIPE automaticamente.",
    businessContext
      ? `Contexto obrigatório do negócio: ${businessContext}. Escreva a copy para esse ramo sem inventar oferta, preço, condição ou característica.`
      : "",
    businessContext &&
      /\b(cons[oó]rcio|seguro|seguradora|financeira|autoescola|oficina|lava[\s-]?jato|locadora)\b/i
        .test(businessContext)
      ? "Uma foto de veículo é apenas tema visual deste negócio: não ofereça FIPE, km, repasse ou anúncio de venda de veículo automaticamente."
      : "",
  ].filter(Boolean).join("\n");
}

export function generalSpecialistAllowsTool(
  toolName: string,
  explicitFipe = false,
): boolean {
  return toolName !== "consultar_fipe" || explicitFipe;
}

export function generalSpecialistPhotoButtons() {
  return singlePhotoActionButtons();
}
