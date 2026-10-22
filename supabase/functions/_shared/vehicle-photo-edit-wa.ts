import { vehiclePhotoActionId } from "./vehicle-photo-direct-menu.ts";

export const VEHICLE_PHOTO_EDIT_PREFIX = "vehicle_photo_edit:";

export function vehiclePhotoEditInteractiveId(action: string): string {
  return `${VEHICLE_PHOTO_EDIT_PREFIX}${action}`;
}

export function parseVehiclePhotoEditInteractiveId(text: string): string | null {
  const match = String(text || "").match(
    /<<INTERACTIVE_ID:vehicle_photo_edit:([^>]+)>>/i,
  );
  return match?.[1]?.trim().toLowerCase() || null;
}

export function vehiclePhotoEditMenuButtons() {
  return {
    body: "Como você quer editar esta foto? (O veículo não será alterado.)",
    buttons: [
      {
        id: vehiclePhotoEditInteractiveId("enhance"),
        title: "Melhorar luz e cor",
      },
      {
        id: vehiclePhotoEditInteractiveId("studio"),
        title: "Fundo de estúdio",
      },
      {
        id: vehiclePhotoEditInteractiveId("crop"),
        title: "Recortar",
      },
    ],
  };
}

/** Modo passado ao toolEditarImagem — sem logo/marca automática. */
export function vehiclePhotoEditToolMode(
  action: string,
): "melhoria" | "projeto_ambiente" | "cena_produto" {
  if (action === "studio") return "projeto_ambiente";
  if (action === "crop") return "cena_produto";
  return "melhoria";
}

export function vehiclePhotoEditUserPrompt(action: string): string {
  if (action === "studio") {
    return "Troque apenas o fundo por um estúdio neutro. Não altere o veículo, rodas, cor, avarias nem adicione logos.";
  }
  if (action === "crop") {
    return "Recorte a imagem mantendo o veículo intacto, sem alterar modelo, cor ou detalhes.";
  }
  return "Melhore luz e cor da foto sem alterar o veículo, sem logos e sem mudar modelo ou cor.";
}
