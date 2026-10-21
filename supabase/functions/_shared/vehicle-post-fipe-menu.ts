import { GESTAO_ASSISTENTE_MAP } from "./gestao-assistente-map.ts";

type VehiclePostFipeMenuList = {
  body: string;
  button: string;
  section_title: string;
  rows: Array<{ id: string; title: string; description?: string }>;
};

export const VEHICLE_POST_FIPE_PREFIX = "vehicle_post_fipe:";

export function vehiclePostFipeInteractiveId(action: string): string {
  return `${VEHICLE_POST_FIPE_PREFIX}${action}`;
}

export function parseVehiclePostFipeInteractiveId(
  text: string,
): string | null {
  const match = String(text || "").match(
    /<<INTERACTIVE_ID:vehicle_post_fipe:([^>]+)>>/i,
  );
  return match?.[1]?.trim().toLowerCase() || null;
}

export function shouldOfferVehiclePostFipeMenu(
  agentState?: Record<string, unknown> | null,
): boolean {
  const pending = agentState?.pending_vehicle_identification as
    | { confirmed?: boolean }
    | undefined;
  return pending?.confirmed === true;
}

export function vehiclePostFipeMenuList(): VehiclePostFipeMenuList {
  return {
    body: "O que você quer fazer com este veículo?",
    button: "Escolher ação",
    section_title: "Próximo passo",
    rows: [
      {
        id: vehiclePostFipeInteractiveId("ad"),
        title: "Arte de anúncio",
        description: "Gerar arte com a foto atual",
      },
      {
        id: vehiclePostFipeInteractiveId("meta"),
        title: "Anúncio pago (Meta)",
        description: "Campanha paga no Meta Ads",
      },
      {
        id: vehiclePostFipeInteractiveId("video"),
        title: "Vídeo",
        description: "Roteiro e vídeo animado",
      },
      {
        id: vehiclePostFipeInteractiveId("estoque"),
        title: "Cadastrar no estoque",
        description: "Estoque vitrine no painel",
      },
      {
        id: vehiclePostFipeInteractiveId("troca"),
        title: "Avaliar como troca",
        description: "Ficha de avaliação de troca",
      },
    ],
  };
}

export function vehiclePostFipeEstoqueGuide(): string {
  const entry = GESTAO_ASSISTENTE_MAP.find((item) => item.id === "vitrine") ??
    GESTAO_ASSISTENTE_MAP.find((item) => item.id === "estoque");
  if (!entry) {
    return "Abra Estoque vitrine no painel (/veiculos) para cadastrar este veículo.";
  }
  const steps = entry.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return `${entry.title} — ${entry.purpose}\n\nPasso a passo:\n${steps}`;
}

export function vehiclePostFipeTrocaGuide(): string {
  return [
    "Avaliar como troca — ficha de avaliação no painel.",
    "",
    "Passo a passo:",
    "1. Abra Gestão › Trocas (/gestao/trocas).",
    "2. Toque em Nova troca e preencha a ficha com os dados do veículo.",
    "3. Envie as fotos pelo roteiro da ficha (mesmo fluxo de laudo IA).",
  ].join("\n");
}

export function vehiclePostFipeMetaTriggerText(): string {
  return "Quero uma campanha paga no Meta Ads com este veículo";
}

export function vehiclePostFipeVideoTheme(
  agentState?: Record<string, unknown> | null,
): string {
  const pending = agentState?.pending_vehicle_identification as {
    confirmed_title?: string;
    data?: { titulo?: string };
    identification?: { marca?: string; modelo?: string };
  } | undefined;
  const title = String(
    pending?.confirmed_title ||
      pending?.data?.titulo ||
      `${pending?.identification?.marca || ""} ${
        pending?.identification?.modelo || ""
      }`.trim(),
  ).trim();
  return title ? `Vídeo promocional do ${title}` : "Vídeo promocional do veículo";
}
