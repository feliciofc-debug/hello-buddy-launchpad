import type { VehicleIdentification } from "./vehicle-identification.ts";
import { hasSpecificVehicleModel } from "./vehicle-identification.ts";
import { vehiclePostFipeInteractiveId } from "./vehicle-post-fipe-menu.ts";
import { VEHICLE_PHOTO_MENU_VISIBLE_ACTIONS } from "./vehicle-photo-menu-config.ts";

export const VEHICLE_PHOTO_ACTION_PREFIX = "vehicle_photo_action:";
export const VEHICLE_PHOTO_LIST_BODY_LIMIT = 1024;

const MENU_INSTRUCTION = "Escolha o que fazer com este veículo.";

const FORBIDDEN_VISIBLE_DETAIL =
  /\b(pre[cç]o|R\$|fipe|vers[aã]o|quilometragem|\bkm\b|motor\s*\d|\d{4}\b|\b20\d{2}\b|\b19\d{2}\b)\b/i;

export function vehiclePhotoActionId(action: string): string {
  return `${VEHICLE_PHOTO_ACTION_PREFIX}${action}`;
}

export function parseVehiclePhotoActionId(text: string): string | null {
  const match = String(text || "").match(
    /<<INTERACTIVE_ID:vehicle_photo_action:([^>]+)>>/i,
  );
  return match?.[1]?.trim().toLowerCase() || null;
}

function clipListBody(value: string): string {
  const compact = value.replace(/\n{3,}/g, "\n\n").trim();
  if (compact.length <= VEHICLE_PHOTO_LIST_BODY_LIMIT) return compact;
  const slice = compact.slice(0, VEHICLE_PHOTO_LIST_BODY_LIMIT);
  const atWord = slice.replace(/\s+\S*$/, "").trim();
  const atSentence = atWord.replace(/[^.!?…]*$/, "").trim();
  const clipped = (atSentence.length >= 40 ? atSentence : atWord).trim();
  return clipped.endsWith("…") || clipped.endsWith("...")
    ? clipped
    : `${clipped}…`;
}

function normalizeDetail(value: string): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 48);
}

function visibleDetailSnippets(
  identification: VehicleIdentification,
): string[] {
  const details: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const clean = normalizeDetail(raw);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key) || FORBIDDEN_VISIBLE_DETAIL.test(clean)) {
      return;
    }
    seen.add(key);
    details.push(clean);
  };
  if (identification.carroceria) add(identification.carroceria);
  for (const hint of identification.pistas_visuais || []) {
    if (details.length >= 2) break;
    add(hint);
  }
  return details.slice(0, 2);
}

/** Linha "Pela foto parece um …" com marca, modelo, faixa, cor e detalhes visíveis. */
export function vehiclePhotoIdentificationLine(
  identification: VehicleIdentification | null,
): string | null {
  if (
    !identification ||
    identification.confianca === "baixa" ||
    !hasSpecificVehicleModel(identification)
  ) {
    return null;
  }
  const chunks: string[] = [];
  const title = `${identification.marca || ""} ${identification.modelo || ""}`
    .trim();
  if (title) chunks.push(title);
  if (identification.cor) chunks.push(String(identification.cor).trim());
  if (identification.geracao_ou_faixa_de_anos) {
    chunks.push(String(identification.geracao_ou_faixa_de_anos).trim());
  }
  for (const detail of visibleDetailSnippets(identification)) {
    chunks.push(detail);
  }
  const description = chunks.join(", ");
  return `Pela foto parece um ${description}.`.replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ");
}

export function vehiclePhotoAppearsMessage(
  identification: VehicleIdentification | null,
): string {
  return vehiclePhotoIdentificationLine(identification) ??
    "Não consegui identificar o modelo com segurança. Qual é a marca, o modelo e o ano?";
}

export function vehiclePhotoRepeatedAppearsMessage(
  _description: string,
  identification: VehicleIdentification | null,
): string {
  const line = vehiclePhotoIdentificationLine(identification);
  if (!line) return vehiclePhotoAppearsMessage(identification);
  return `Essa foto você já tinha me mandado. ${line}`;
}

export function vehiclePhotoDirectMenuBody(input: {
  identification: VehicleIdentification | null;
  repeated?: boolean;
}): string {
  const line = vehiclePhotoIdentificationLine(input.identification);
  if (!line) {
    return clipListBody(
      `${vehiclePhotoAppearsMessage(input.identification)}\n${MENU_INSTRUCTION}`,
    );
  }
  const lead = input.repeated
    ? `Essa foto você já tinha me mandado. ${line}`
    : line;
  return clipListBody(`${lead}\n${MENU_INSTRUCTION}`);
}

const VEHICLE_PHOTO_DIRECT_ROWS = [
  {
    id: vehiclePhotoActionId("ad"),
    title: "Criar arte de anúncio",
    description: "Montar arte com a foto atual",
  },
  {
    id: vehiclePhotoActionId("post"),
    title: "Postar nas redes",
    description: "Feed ou story (sem TikTok)",
  },
  {
    id: vehiclePhotoActionId("meta"),
    title: "Anúncio pago (Meta)",
    description: "Campanha no Meta Ads",
  },
  {
    id: vehiclePhotoActionId("fipe"),
    title: "Consultar FIPE",
    description: "Tabela FIPE deste modelo",
  },
  {
    id: vehiclePhotoActionId("troca"),
    title: "Vistoria / Troca",
    description: "Guia de avaliação de troca",
  },
  {
    id: vehiclePhotoActionId("correct"),
    title: "Corrigir modelo",
    description: "Escolher marca/modelo na FIPE",
  },
  {
    id: vehiclePhotoActionId("edit"),
    title: "Editar foto",
    description: "Luz, fundo ou recorte",
  },
];

export function vehiclePhotoDirectActionList(
  identification: VehicleIdentification | null,
  options?: { repeated?: boolean },
) {
  return {
    body: vehiclePhotoDirectMenuBody({
      identification,
      repeated: options?.repeated,
    }),
    button: "Ver opções",
    section_title: "Ações",
    rows: VEHICLE_PHOTO_DIRECT_ROWS.filter((row) =>
      VEHICLE_PHOTO_MENU_VISIBLE_ACTIONS.has(
        row.id.replace(VEHICLE_PHOTO_ACTION_PREFIX, ""),
      )
    ),
  };
}

/** Ações pós-confirmação reutilizam os IDs do menu pós-FIPE quando equivalentes. */
export function vehiclePhotoActionToPostFipe(action: string): string | null {
  if (action === "ad") return "ad";
  if (action === "meta") return "meta";
  if (action === "post") return "post";
  if (action === "troca") return "troca";
  if (action === "correct") return "correct";
  if (action === "edit") return "edit";
  if (action === "video") return "video";
  if (action === "estoque") return "estoque";
  return null;
}

export function vehiclePhotoActionUsesPostFipeHandler(action: string): boolean {
  return vehiclePhotoActionToPostFipe(action) != null;
}

export function vehiclePhotoPostFipeRowId(action: string): string {
  const mapped = vehiclePhotoActionToPostFipe(action);
  return mapped ? vehiclePostFipeInteractiveId(mapped) : "";
}
