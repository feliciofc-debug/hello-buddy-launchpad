import { stripAudioTranscriptPrefix } from "./vitrine-inbound-text.ts";

export const VEHICLE_PHOTO_EDIT_PREFIX = "vehicle_photo_edit:";
export const VEHICLE_PHOTO_EDIT_TTL_MS = 30 * 60 * 1000;

export function vehiclePhotoEditInteractiveId(action: string): string {
  return `${VEHICLE_PHOTO_EDIT_PREFIX}${action}`;
}

export function parseVehiclePhotoEditInteractiveId(
  text: string,
): string | null {
  const match = String(text || "").match(
    /<<INTERACTIVE_ID:vehicle_photo_edit:([^>]+)>>/i,
  );
  return match?.[1]?.trim().toLowerCase() || null;
}

export function vehiclePhotoEditMenuButtons() {
  return {
    body:
      "Como você quer a foto? Me diga por texto ou áudio (ex.: “fundo de estúdio”, “rua à noite com luzes da cidade”, “melhorar a luz”).",
    buttons: [
      {
        id: vehiclePhotoEditInteractiveId("studio"),
        title: "Fundo de estúdio",
      },
      {
        id: vehiclePhotoEditInteractiveId("enhance"),
        title: "Melhorar luz",
      },
    ],
  };
}

export type PendingVehiclePhotoEdit = {
  media_id: string;
  created_at: string;
};

export function pendingVehiclePhotoEditIsActive(
  pending: PendingVehiclePhotoEdit | null | undefined,
  nowMs = Date.now(),
): boolean {
  const created = Date.parse(String(pending?.created_at || ""));
  return Boolean(
    pending?.media_id &&
      Number.isFinite(created) &&
      created <= nowMs &&
      nowMs - created <= VEHICLE_PHOTO_EDIT_TTL_MS,
  );
}

export function isVehiclePhotoEditCancel(text: unknown): boolean {
  const value = stripAudioTranscriptPrefix(String(text ?? ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return /^(?:cancelar|cancela|cancelar edicao|parar|sair)[.!?]?$/.test(value);
}

export function vehiclePhotoEditInstruction(
  text: unknown,
  shortcut?: string | null,
): string {
  if (shortcut === "studio") return "fundo de estúdio neutro";
  if (shortcut === "enhance") return "melhorar a luz";
  return stripAudioTranscriptPrefix(String(text ?? "")).trim();
}

export function vehiclePhotoEditIsCreativeScene(instruction: string): boolean {
  return /\b(fundo|est[uú]dio|rua|cidade|cen[aá]rio|ambiente|showroom|praia|campo|noite)\b/i
    .test(instruction);
}

/** Modo dedicado a veículo: nunca herda modo/logo/dados de uma arte anterior. */
export function vehiclePhotoEditToolMode(
  instruction: string,
):
  | "melhoria"
  | "cena_produto"
  | "aplicar_logo"
  | "aplicar_logo_cenario" {
  const asksLogo = /\b(logo|logotipo|logomarca|minha marca)\b/i.test(
    instruction,
  );
  if (asksLogo && vehiclePhotoEditIsCreativeScene(instruction)) {
    return "aplicar_logo_cenario";
  }
  if (asksLogo) return "aplicar_logo";
  return vehiclePhotoEditIsCreativeScene(instruction)
    ? "cena_produto"
    : "melhoria";
}

export function vehiclePhotoEditExplicitTexts(instruction: string): string[] {
  if (
    !/\b(escrev[ae]|coloque? o texto|adicione? o texto|texto|pre[cç]o|km|quilometragem)\b/i
      .test(instruction)
  ) {
    return [];
  }
  const quoted = [...instruction.matchAll(/[“"]([^”"]{1,80})[”"]/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  return quoted.slice(0, 5);
}

export function vehiclePhotoEditRenderTexts(instruction: string): string[] {
  return [
    ...vehiclePhotoEditExplicitTexts(instruction),
    ...(vehiclePhotoEditIsCreativeScene(instruction)
      ? ["Imagem ilustrativa"]
      : []),
  ];
}

export function vehiclePhotoEditUserPrompt(instruction: string): string {
  const lines = [
    `INSTRUÇÃO ATUAL DO DONO: ${instruction}`,
    "REGRAS FIXAS DESTA EDIÇÃO:",
    "- Preserve o veículo exatamente como na foto: mesmo modelo, cor, rodas, acessórios, avarias, placa, proporções e ângulo.",
    "- Não use nem reaproveite preço, quilometragem, “único dono”, opcionais ou qualquer dado de anúncio/arte anterior.",
    "- Não adicione texto, preço, km ou logo, salvo se a INSTRUÇÃO ATUAL acima pedir isso explicitamente.",
    "- Altere somente luz/cor ou o cenário solicitado; resultado fotorealista.",
  ];
  if (vehiclePhotoEditIsCreativeScene(instruction)) {
    lines.push(
      "- Como o cenário será criado por IA, inclua apenas um selo pequeno e discreto “Imagem ilustrativa”.",
    );
  }
  return lines.join("\n");
}
