import { stripAudioTranscriptPrefix } from "./vitrine-inbound-text.ts";

export const VEHICLE_PHOTO_EDIT_PREFIX = "vehicle_photo_edit:";
export const VEHICLE_PHOTO_EDIT_TTL_MS = 30 * 60 * 1000;
export const VEHICLE_PHOTO_EDIT_MAX_PAID_CALLS = 1;

export function vehiclePhotoEditEnginePlan(localCutoutAvailable: boolean) {
  return {
    strategy: localCutoutAvailable
      ? "local_cutout_background"
      : "single_ai_edit_fallback",
    maxPaidCalls: VEHICLE_PHOTO_EDIT_MAX_PAID_CALLS,
    usesPaidMask: false,
    usesPaidColorValidation: false,
  } as const;
}

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
    body: "Me manda o seu prompt, por texto ou áudio.",
    buttons: [],
  };
}

export function vehiclePhotoEditMenuResponse() {
  return {
    text: vehiclePhotoEditMenuButtons().body,
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

export function vehiclePhotoEditShortcutExecutesDirectly(
  shortcut: string | null | undefined,
): boolean {
  return shortcut === "studio" || shortcut === "enhance";
}

export function vehiclePhotoEditIsCreativeScene(instruction: string): boolean {
  return /\b(fundo|est[uú]dio|rua|estrada|cidade|cen[aá]rio|ambiente|showroom|praia|campo|montanhas?|p[oô]r do sol|noite)\b/i
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
  return vehiclePhotoEditExplicitTexts(instruction);
}

export function vehiclePhotoEditUserPrompt(instruction: string): string {
  const lines = [
    `INSTRUÇÃO ATUAL DO DONO: ${instruction}`,
    "REGRAS FIXAS DESTA EDIÇÃO:",
    "- Preserve o veículo exatamente como na foto: mesmo modelo, cor, rodas, acessórios, avarias, placa, proporções e ângulo.",
    "- Faça uma única edição. Nunca redesenhe, repinte ou substitua o veículo; altere somente o fundo ou a luz pedidos.",
    "- Não use nem reaproveite preço, quilometragem, “único dono”, opcionais ou qualquer dado de anúncio/arte anterior.",
    "- Não adicione texto, preço, km ou logo, salvo se a INSTRUÇÃO ATUAL acima pedir isso explicitamente.",
    "- Altere somente luz/cor ou o cenário solicitado; resultado fotorealista.",
    "- Pode realçar brilho, reflexos, contraste, nitidez e aspecto encerado/polido, mas preserve rigorosamente o tom/cor original.",
    "- Nunca apague nem esconda riscos, amassados, ferrugem, desgaste ou avarias; nunca troque rodas, peças ou acessórios.",
  ];
  return lines.join("\n");
}

export function vehiclePhotoEditPreservarAmbiente(
  instruction: string,
): boolean | undefined {
  return vehiclePhotoEditIsCreativeScene(instruction) ? false : true;
}

export const VEHICLE_STATE_REFUSAL =
  "Realcei a pintura e o brilho. Não removo avarias nem mudo a cor para não enganar o comprador.";

export function vehiclePhotoEditSafetyPlan(instruction: string): {
  refused: boolean;
  safeInstruction: string;
} {
  const original = String(instruction || "").trim();
  const forbidden = [
    /\b(?:remov(?:er|a)|tir(?:ar|e)|apag(?:ar|ue)|escond(?:er|a))\s+(?:os?\s+|as?\s+)?(?:riscos?|arranh(?:ões|oes)|amassados?|ferrugem|avarias?|desgaste)\b(?:\s+(?:da|do|das|dos)\s+\w+)?/gi,
    /\b(?:troc(?:ar|que)|mud(?:e|ar)|pint(?:e|ar))\s+(?:a\s+)?cor\b/gi,
    /\b(?:troc(?:ar|que)|mud(?:e|ar)|substitu(?:a|ir))\s+(?:as?\s+|os?\s+)?(?:rodas?|pneus?|pe[cç]as?|far[oó]is?|para-choque)\b/gi,
  ];
  let safeInstruction = original;
  let refused = false;
  for (const pattern of forbidden) {
    if (pattern.test(safeInstruction)) refused = true;
    pattern.lastIndex = 0;
    safeInstruction = safeInstruction.replace(pattern, " ");
  }
  if (refused) {
    safeInstruction = safeInstruction.replace(
      /\b(?:e\s+)?(?:as?\s+|os?\s+)?(?:rodas?|pneus?|pe[cç]as?|far[oó]is?|para-choque|riscos?|arranh(?:ões|oes)|amassados?|ferrugem|avarias?)\b/gi,
      " ",
    );
  }
  safeInstruction = safeInstruction
    .replace(/\s+(?:e|com)\s*(?=$|[,.])/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "")
    .trim();
  if (refused && !safeInstruction) {
    safeInstruction =
      "realçar a pintura e o brilho sem mudar a cor, mantendo todas as avarias visíveis";
  }
  return { refused, safeInstruction };
}

export function vehiclePhotoFollowUpLooksLikeEdit(value: string): boolean {
  const text = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /\b(manter|melhorar|ajustar|corrigir|clarear|escurecer|luz|cor|nitidez|reflexo|recorte|fundo|cenario|ambiente|estudio|showroom|rua|estrada|montanha|praia|lataria|risco|amassado|ferrugem|roda|peca)\b/
    .test(text);
}

export function vehiclePhotoRequestsOriginalAppearance(value: string): boolean {
  return /\b(?:manter|preservar|voltar|restaurar)\b.{0,35}\b(?:cor|apar[eê]ncia|carro|ve[ií]culo)\b.{0,35}\boriginal\b|\bcor original\b/i
    .test(String(value || ""));
}

export function vehiclePhotoRequestsPaintEnhancement(value: string): boolean {
  return /\b(pintura|lataria|brilho|brilhante|reflexos?|encerad[oa]|polid[oa]|contraste|nitidez|luz|ilumina[cç][aã]o|cor original)\b/i
    .test(String(value || ""));
}

export type VehiclePhotoSceneAdjustmentPlan = {
  fromOriginal: boolean;
  sourceMediaId: string;
  sourceUrl: string;
  instruction: string;
  modo: ReturnType<typeof vehiclePhotoEditToolMode>;
  preservarAmbiente: boolean | undefined;
};

/** Cenário novo parte da foto raiz; melhorias partem do resultado atual. */
export function planVehiclePhotoSceneAdjustment(input: {
  adjustment: string;
  currentMediaId: string;
  currentUrl: string;
  rootMediaId?: string | null;
  rootUrl?: string | null;
}): VehiclePhotoSceneAdjustmentPlan {
  const adjustment = String(input.adjustment || "").trim();
  const modo = vehiclePhotoEditToolMode(adjustment);
  const rootId = String(input.rootMediaId || "").trim();
  const rootUrl = String(input.rootUrl || "").trim();
  if (
    vehiclePhotoEditIsCreativeScene(adjustment) && rootId && rootUrl
  ) {
    return {
      fromOriginal: true,
      sourceMediaId: rootId,
      sourceUrl: rootUrl,
      instruction: adjustment,
      modo: modo === "melhoria" ? "cena_produto" : modo,
      preservarAmbiente: false,
    };
  }
  return {
    fromOriginal: false,
    sourceMediaId: input.currentMediaId,
    sourceUrl: input.currentUrl,
    instruction: adjustment,
    modo,
    preservarAmbiente: vehiclePhotoEditPreservarAmbiente(adjustment),
  };
}
