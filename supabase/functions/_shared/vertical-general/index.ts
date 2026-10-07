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

export function generalSpecialistPrompt(): string {
  return [
    "ESPECIALISTA GERAL DE PRODUTOS E SERVIÇOS.",
    "Analise a foto atual e use somente fatos informados.",
    "Ferramentas próprias: análise, edição de cenário, post, carrossel premium e anúncio de produto.",
    "Nunca leia FIPE, anúncio, lote ou carrossel da vertical de veículos.",
  ].join("\n");
}

export function generalSpecialistAllowsTool(toolName: string): boolean {
  return toolName !== "consultar_fipe";
}

export function generalSpecialistPhotoButtons() {
  return singlePhotoActionButtons();
}
