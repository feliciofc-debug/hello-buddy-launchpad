import type { VehicleIdentification } from "./vehicle-identification.ts";
import { hasSpecificVehicleModel } from "./vehicle-identification.ts";
import { normalizeOwnerPhotoDescription } from "./owner-photo-confirm.ts";
import { vehiclePostFipeInteractiveId } from "./vehicle-post-fipe-menu.ts";

export const VEHICLE_PHOTO_ACTION_PREFIX = "vehicle_photo_action:";

export function vehiclePhotoActionId(action: string): string {
  return `${VEHICLE_PHOTO_ACTION_PREFIX}${action}`;
}

export function parseVehiclePhotoActionId(text: string): string | null {
  const match = String(text || "").match(
    /<<INTERACTIVE_ID:vehicle_photo_action:([^>]+)>>/i,
  );
  return match?.[1]?.trim().toLowerCase() || null;
}

export function vehiclePhotoAppearsMessage(
  identification: VehicleIdentification | null,
): string {
  if (
    !identification ||
    identification.confianca === "baixa" ||
    !hasSpecificVehicleModel(identification)
  ) {
    return "Não consegui identificar o modelo com segurança. Qual é a marca, o modelo e o ano?";
  }
  const vehicle = `${identification.marca} ${identification.modelo}`.trim();
  const range = identification.geracao_ou_faixa_de_anos
    ? ` ${identification.geracao_ou_faixa_de_anos}`
    : "";
  const color = identification.cor ? ` ${identification.cor}` : "";
  return `Pela foto parece um ${vehicle}${range}${color}.`.replace(/\s+\./g, ".")
    .replace(/\s{2,}/g, " ");
}

export function vehiclePhotoRepeatedAppearsMessage(
  description: string,
  identification: VehicleIdentification | null,
): string {
  const seen = normalizeOwnerPhotoDescription(description);
  const base = vehiclePhotoAppearsMessage(identification);
  if (!seen || base.startsWith("Não consegui")) return base;
  return `Essa foto você já tinha me mandado. ${base}`;
}

export function vehiclePhotoDirectActionList() {
  return {
    body: "Escolha o que fazer com este veículo.",
    button: "Ver opções",
    section_title: "Ações",
    rows: [
      {
        id: vehiclePhotoActionId("ad"),
        title: "Criar arte de anúncio",
        description: "Montar arte com a foto atual",
      },
      {
        id: vehiclePhotoActionId("post"),
        title: "Postar nas redes",
        description: "Feed, story ou TikTok",
      },
      {
        id: vehiclePhotoActionId("meta"),
        title: "Anúncio pago (Meta)",
        description: "Campanha no Meta Ads",
      },
      {
        id: vehiclePhotoActionId("video"),
        title: "Criar vídeo",
        description: "Roteiro e vídeo animado",
      },
      {
        id: vehiclePhotoActionId("fipe"),
        title: "Consultar FIPE",
        description: "Tabela FIPE deste modelo",
      },
      {
        id: vehiclePhotoActionId("estoque"),
        title: "Cadastrar no estoque",
        description: "Estoque vitrine no painel",
      },
      {
        id: vehiclePhotoActionId("troca"),
        title: "Vistoria / Troca",
        description: "Guia de avaliação de troca",
      },
      {
        id: vehiclePhotoActionId("correct"),
        title: "Corrigir modelo",
        description: "Informar marca e modelo corretos",
      },
    ],
  };
}

/** Ações pós-confirmação reutilizam os IDs do menu pós-FIPE quando equivalentes. */
export function vehiclePhotoActionToPostFipe(action: string): string | null {
  if (action === "ad") return "ad";
  if (action === "meta") return "meta";
  if (action === "video") return "video";
  if (action === "estoque") return "estoque";
  if (action === "troca") return "troca";
  return null;
}

export function vehiclePhotoActionUsesPostFipeHandler(action: string): boolean {
  return vehiclePhotoActionToPostFipe(action) != null;
}

export function vehiclePhotoPostFipeRowId(action: string): string {
  const mapped = vehiclePhotoActionToPostFipe(action);
  return mapped ? vehiclePostFipeInteractiveId(mapped) : "";
}
