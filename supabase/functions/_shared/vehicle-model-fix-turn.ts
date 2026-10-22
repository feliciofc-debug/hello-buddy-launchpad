import type { FipeListItem } from "./fipe.ts";
import type { VehicleIdentification } from "./vehicle-identification.ts";
import {
  applyVehicleModelFixTitle,
  parseVehicleModelFixBrandCode,
  parseVehicleModelFixModelRef,
  vehicleModelBrandListRows,
  vehicleModelCorrectionButtons,
  vehicleModelFixAltLabel,
  vehicleModelModelListRows,
} from "./vehicle-model-correction-wa.ts";

export type VehicleModelFixTurnResult = {
  text: string;
  interactiveButtons?: {
    body: string;
    buttons: Array<{ id: string; title: string }>;
  };
  interactiveList?: {
    body: string;
    button: string;
    section_title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  };
  confirmedTitle?: string;
};

export function vehicleModelCorrectionStartResponse(
  identification: VehicleIdentification | null,
): VehicleModelFixTurnResult {
  const menu = vehicleModelCorrectionButtons(identification);
  return {
    text: menu.body,
    interactiveButtons: menu,
  };
}

export async function runVehicleModelFixTurn(input: {
  action: string;
  identification: VehicleIdentification;
  listarMarcas: () => Promise<FipeListItem[]>;
  listarModelos: (brandCode: string, query?: string) => Promise<FipeListItem[]>;
}): Promise<VehicleModelFixTurnResult> {
  const { action, identification } = input;

  if (action === "other") {
    const brands = await input.listarMarcas();
    const rows = vehicleModelBrandListRows(brands);
    return {
      text: "Escolha a marca na tabela FIPE:",
      interactiveList: {
        body: "Qual é a marca correta?",
        button: "Ver marcas",
        section_title: "Marcas FIPE",
        rows,
      },
    };
  }

  if (action.startsWith("alt:")) {
    const index = Number(action.slice(4));
    const label = vehicleModelFixAltLabel(identification, index);
    if (!label) {
      return { text: "Não encontrei essa opção. Toque em Corrigir modelo de novo." };
    }
    return {
      text: `Vou usar ${label}.`,
      confirmedTitle: label,
    };
  }

  const brandCode = parseVehicleModelFixBrandCode(action);
  if (brandCode) {
    if (brandCode === "other") {
      const brands = await input.listarMarcas();
      return {
        text: "Escolha a marca na tabela FIPE:",
        interactiveList: {
          body: "Qual é a marca correta?",
          button: "Ver marcas",
          section_title: "Marcas FIPE",
          rows: vehicleModelBrandListRows(brands),
        },
      };
    }
    const models = await input.listarModelos(brandCode, identification.modelo || "");
    return {
      text: "Agora escolha o modelo:",
      interactiveList: {
        body: "Qual modelo combina com a foto?",
        button: "Ver modelos",
        section_title: "Modelos FIPE",
        rows: vehicleModelModelListRows(models, brandCode),
      },
    };
  }

  const modelRef = parseVehicleModelFixModelRef(action);
  if (modelRef) {
    if (modelRef.modelCode === "more") {
      const models = await input.listarModelos(
        modelRef.brandCode,
        identification.modelo || "",
      );
      return {
        text: "Mais modelos desta marca:",
        interactiveList: {
          body: "Qual modelo combina com a foto?",
          button: "Ver modelos",
          section_title: "Modelos FIPE",
          rows: vehicleModelModelListRows(models, modelRef.brandCode),
        },
      };
    }
    const brands = await input.listarMarcas();
    const brand = brands.find((b) => b.code === modelRef.brandCode);
    const models = await input.listarModelos(modelRef.brandCode, "");
    const model = models.find((m) => m.code === modelRef.modelCode);
    const title = `${brand?.name || identification.marca || ""} ${
      model?.name || identification.modelo || ""
    }`.trim();
    if (!title) {
      return { text: "Não encontrei esse modelo na FIPE. Escolha outro." };
    }
    return {
      text: `Modelo atualizado: ${title}.`,
      confirmedTitle: title,
    };
  }

  return { text: "Não entendi essa correção. Toque em Corrigir modelo de novo." };
}

export function mergeVehicleModelFixIdentification(
  identification: VehicleIdentification,
  confirmedTitle: string,
): VehicleIdentification {
  return applyVehicleModelFixTitle(identification, confirmedTitle);
}
