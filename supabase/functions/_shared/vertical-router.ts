export type InboundVertical = "veiculo" | "geral";

export type VerticalDecision = {
  route: InboundVertical;
  confidence: number;
  reason: string;
  needsConfirmation: boolean;
  needsSegmentConfirmation?: boolean;
  explicitFipe?: boolean;
  effectiveSegment?: string | null;
  demoMode?: boolean;
};

export type VerticalVisionResult = {
  route: InboundVertical;
  confidence: number;
  reason?: string;
};

export type VerticalNamespacedState = Record<string, unknown> & {
  vehicle?: Record<string, unknown>;
  general?: Record<string, unknown>;
  vertical_router?: {
    pending_choice?: {
      media_id?: string;
      media_url?: string;
      created_at: string;
    } | null;
    last_route?: InboundVertical;
    updated_at?: string;
    pending_segment_choice?: boolean;
    demo_segment?: {
      segment: string;
      expires_at: string;
    } | null;
    pending_demo_segment?: {
      segment: string;
      created_at: string;
    } | null;
  } | null;
};

export const VEHICLE_STATE_KEYS = new Set([
  "pending_carrossel_veiculo",
  "pending_vehicle_photo_batch",
  "pending_vehicle_identification",
  "pending_fipe",
  "last_fipe",
  "last_anuncio",
]);

export const GENERAL_STATE_KEYS = new Set([
  "pending_carousel",
  "pending_single_photo",
  "pending_image_composition",
  "pending_brand_generation",
  "pending_video_setup",
  "pending_creative_media_ambiguity",
  "pending_client_logo",
  "pending_client_logo_intent",
  "pending_meta_ads_ambiguity",
  "pending_meta_ads_limit",
  "pending_meta_ads_limit_value",
  "brand_image_preference",
]);

export const AMBIGUOUS_AD_STATE_KEYS = new Set([
  "pending_anuncio_cliente",
  "pending_anuncio_styles",
  "pending_anuncio_photo",
  "pending_anuncio_post",
]);

const SHARED_STATE_KEYS = new Set([
  "forward",
  "decisao",
  "site_link_enviado",
  "last_media_interaction",
  "vertical_router",
  "vehicle",
  "general",
  "nome",
  "nome_pergunta",
  "complemento_nome",
]);

export function isVerticalStateKey(key: string): boolean {
  return VEHICLE_STATE_KEYS.has(key) || GENERAL_STATE_KEYS.has(key) ||
    AMBIGUOUS_AD_STATE_KEYS.has(key);
}

function normalize(value: string): string {
  return String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isAutomotiveTenant(segment?: string | null): boolean {
  const value = normalize(segment || "");
  if (
    /\b(consorcio|segur\w*|financeir\w*|autoescola|oficina|lava[\s-]?jato|locadora|aluguel|auto center|auto pecas)\b/
      .test(value)
  ) {
    return false;
  }
  return /\b(concessionaria|revenda|seminovos?|automotiv|veiculos?|carros?|motos?|caminhoes?)\b/
    .test(value);
}

export function explicitVerticalIntent(
  text: string,
): { route: InboundVertical; reason: string } | null {
  const value = normalize(text);
  if (/<<interactive_id:vehicle_(?:carousel|photo_batch):/.test(value)) {
    return { route: "veiculo", reason: "botao_veiculo" };
  }
  if (/<<interactive_id:single_photo:/.test(value)) {
    return { route: "geral", reason: "botao_geral" };
  }
  if (
    /\b(fipe|repasse)\b/.test(value) ||
    /\b(carrossel|carrosel|carrocel|carossel|carosel|carousel|album|galeria)\b[\s\S]{0,50}\b(carro|veiculo|automovel|moto)\b/
      .test(
        value,
      ) ||
    /\b(anuncio|post|arte|fotos?)\b[\s\S]{0,40}\b(carro|veiculo|automovel|moto)\b/
      .test(
        value,
      )
  ) {
    return { route: "veiculo", reason: "pedido_explicito_veiculo" };
  }
  if (
    /\b(caneca|garrafa|roupa|camisa|produto|servico|comida|imovel|logo|embalagem)\b/
      .test(
        value,
      ) ||
    /\b(trocar|mudar|remover|melhorar)\b[\s\S]{0,30}\b(cenario|fundo|foto|imagem)\b/
      .test(
        value,
      )
  ) {
    return { route: "geral", reason: "pedido_explicito_geral" };
  }
  return null;
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function parseVerticalVisionResult(
  raw: string,
): VerticalVisionResult | null {
  try {
    const cleaned = raw.replace(/```json\s*|\s*```/gi, "").trim();
    const parsed = JSON.parse(cleaned);
    const route = parsed?.route === "veiculo" || parsed?.vertical === "veiculo"
      ? "veiculo"
      : parsed?.route === "geral" || parsed?.vertical === "geral"
      ? "geral"
      : null;
    if (!route) return null;
    return {
      route,
      confidence: clampConfidence(
        Number(parsed.confidence ?? parsed.confianca),
      ),
      reason: typeof parsed.reason === "string"
        ? parsed.reason
        : typeof parsed.motivo === "string"
        ? parsed.motivo
        : undefined,
    };
  } catch {
    return null;
  }
}

export function verticalVisionPrompt(): string {
  return [
    "Responda somente JSON puro.",
    "A imagem é de um veículo (carro, moto, caminhão ou parte claramente automotiva) ou de outro produto/serviço?",
    'Formato: {"route":"veiculo"|"geral","confidence":0.0,"reason":"até 5 palavras"}.',
    "Não descreva marca, estado, preço nem itens. Não invente.",
  ].join("\n");
}

export function resolveVertical(input: {
  text?: string;
  tenantSegment?: string | null;
  vision?: VerticalVisionResult | null;
  selectedRoute?: InboundVertical | null;
  isAdmin?: boolean;
  demoSegment?: { segment: string; expires_at: string } | null;
  nowMs?: number;
}): VerticalDecision {
  const nowMs = input.nowMs ?? Date.now();
  const demoActive = !!input.isAdmin && !!input.demoSegment?.segment &&
    new Date(input.demoSegment.expires_at).getTime() > nowMs;
  const effectiveSegment = demoActive
    ? input.demoSegment!.segment
    : input.tenantSegment;
  const explicit = explicitVerticalIntent(input.text || "");
  const explicitFipe = /\b(fipe|tabela\s+fipe)\b/.test(
    normalize(input.text || ""),
  );

  // A conta admin é uma vitrine genérica: sem demo fixada, a visão/pedido
  // escolhe livremente a vertical.
  if (input.isAdmin && !demoActive) {
    if (explicit) {
      return {
        route: explicit.route,
        confidence: 1,
        reason: explicit.reason,
        needsConfirmation: false,
        explicitFipe,
        effectiveSegment: null,
      };
    }
    if (input.selectedRoute) {
      return {
        route: input.selectedRoute,
        confidence: 1,
        reason: "escolha_usuario",
        needsConfirmation: false,
        explicitFipe,
        effectiveSegment: null,
      };
    }
    if (input.vision) {
      const confidence = clampConfidence(input.vision.confidence);
      return {
        route: input.vision.route,
        confidence,
        reason: confidence >= 0.65
          ? input.vision.reason || "visao_admin"
          : "visao_baixa_confianca",
        needsConfirmation: confidence < 0.65,
        explicitFipe,
        effectiveSegment: null,
      };
    }
    return {
      route: "geral",
      confidence: 0.7,
      reason: "admin_automatico_sem_foto",
      needsConfirmation: false,
      explicitFipe,
      effectiveSegment: null,
    };
  }

  if (!String(effectiveSegment || "").trim()) {
    return {
      route: "geral",
      confidence: 0,
      reason: "ramo_nao_configurado",
      needsConfirmation: false,
      needsSegmentConfirmation: true,
      explicitFipe,
      effectiveSegment: null,
      demoMode: demoActive,
    };
  }

  const automotive = isAutomotiveTenant(effectiveSegment);
  // Fora de revenda, inclusive consórcio/seguro/oficina/locadora, a foto
  // continua no especialista geral. FIPE explícita é uma capacidade pontual,
  // não uma troca para o especialista de veículos.
  if (!automotive) {
    return {
      route: "geral",
      confidence: 1,
      reason: explicitFipe
        ? "fipe_explicita_fora_revenda"
        : demoActive
        ? "ramo_demo_nao_automotivo"
        : "ramo_nao_automotivo",
      needsConfirmation: false,
      explicitFipe,
      effectiveSegment,
      demoMode: demoActive,
    };
  }

  if (explicit) {
    return {
      route: explicit.route,
      confidence: 1,
      reason: explicit.reason,
      needsConfirmation: false,
      explicitFipe,
      effectiveSegment,
      demoMode: demoActive,
    };
  }
  if (input.selectedRoute) {
    return {
      route: input.selectedRoute,
      confidence: 1,
      reason: "escolha_usuario",
      needsConfirmation: false,
      explicitFipe,
      effectiveSegment,
      demoMode: demoActive,
    };
  }
  if (input.vision) {
    const confidence = clampConfidence(input.vision.confidence);
    if (confidence >= 0.65) {
      return {
        route: input.vision.route,
        confidence,
        reason: input.vision.reason || "visao",
        needsConfirmation: false,
        explicitFipe,
        effectiveSegment,
        demoMode: demoActive,
      };
    }
    return {
      route: automotive ? "veiculo" : "geral",
      confidence,
      reason: "visao_baixa_confianca",
      needsConfirmation: true,
      explicitFipe,
      effectiveSegment,
      demoMode: demoActive,
    };
  }
  return {
    route: "veiculo",
    confidence: 0.8,
    reason: demoActive ? "ramo_demo_revenda" : "ramo_revenda",
    needsConfirmation: false,
    explicitFipe,
    effectiveSegment,
    demoMode: demoActive,
  };
}

function looksLikeVehicleState(state: Record<string, unknown>): boolean {
  if (state.pending_carrossel_veiculo || state.pending_vehicle_photo_batch) {
    return true;
  }
  const last = state.last_anuncio as
    | { data?: Record<string, unknown> }
    | undefined;
  const data = last?.data ?? {};
  return /\b(carro|veiculo|automovel|moto|km|cambio|fipe)\b/.test(
    normalize(JSON.stringify(data)),
  );
}

export function migrateVerticalState(
  input: VerticalNamespacedState,
): { state: VerticalNamespacedState; changed: boolean } {
  const state = structuredClone(input ?? {});
  const vehicle = { ...(state.vehicle ?? {}) };
  const general = { ...(state.general ?? {}) };
  let changed = false;
  const vehicleAd = looksLikeVehicleState(state);

  for (const key of Object.keys(state)) {
    if (VEHICLE_STATE_KEYS.has(key)) {
      if (!(key in vehicle)) vehicle[key] = state[key];
      delete state[key];
      changed = true;
    } else if (GENERAL_STATE_KEYS.has(key)) {
      const target = key === "pending_carousel" && vehicleAd
        ? vehicle
        : general;
      if (!(key in target)) target[key] = state[key];
      delete state[key];
      changed = true;
    } else if (AMBIGUOUS_AD_STATE_KEYS.has(key)) {
      const target = vehicleAd ? vehicle : general;
      if (!(key in target)) target[key] = state[key];
      delete state[key];
      changed = true;
    }
  }
  state.vehicle = vehicle;
  state.general = general;
  return { state, changed };
}

export function scopedVerticalState(
  input: VerticalNamespacedState,
  route: InboundVertical,
): VerticalNamespacedState {
  const migrated = migrateVerticalState(input).state;
  const selected = route === "veiculo"
    ? migrated.vehicle ?? {}
    : migrated.general ?? {};
  const scoped: VerticalNamespacedState = {};
  for (const [key, value] of Object.entries(migrated)) {
    if (SHARED_STATE_KEYS.has(key)) scoped[key] = value;
  }
  Object.assign(scoped, selected);
  Object.defineProperties(scoped, {
    __vertical_scope: { value: route, enumerable: false },
    __vertical_root: { value: migrated, enumerable: false, writable: true },
  });
  return scoped;
}

export function applyVerticalStatePatch(
  current: VerticalNamespacedState,
  patch: VerticalNamespacedState,
): VerticalNamespacedState {
  const route = (current as Record<string, unknown>).__vertical_scope as
    | InboundVertical
    | undefined;
  if (!route) return { ...current, ...patch };
  const root = structuredClone(
    ((current as Record<string, unknown>).__vertical_root ??
      migrateVerticalState(current).state) as VerticalNamespacedState,
  );
  const bucket = {
    ...((route === "veiculo" ? root.vehicle : root.general) ?? {}),
  };
  for (const [key, value] of Object.entries(patch)) {
    if (
      VEHICLE_STATE_KEYS.has(key) || GENERAL_STATE_KEYS.has(key) ||
      AMBIGUOUS_AD_STATE_KEYS.has(key)
    ) {
      bucket[key] = value;
    } else {
      root[key] = value;
    }
  }
  if (route === "veiculo") root.vehicle = bucket;
  else root.general = bucket;
  root.vertical_router = {
    ...(root.vertical_router ?? {}),
    last_route: route,
    updated_at: new Date().toISOString(),
  };
  return root;
}

export function verticalChoiceButtons() {
  return {
    body: "Esta foto é de qual tipo?",
    buttons: [
      { id: "vertical:vehicle", title: "É um veículo" },
      { id: "vertical:general", title: "É outro produto" },
    ],
  };
}

export function businessSegmentButtons() {
  return {
    body: "Qual é o ramo principal deste negócio?",
    buttons: [
      {
        id: "vertical_segment:automotive",
        title: "Revenda de veículos",
      },
      { id: "vertical_segment:other", title: "Outro ramo" },
    ],
  };
}

export function parseDemoSegmentCommand(
  text: string,
): { action: "set"; segment: string } | { action: "exit" } | null {
  const value = normalize(text)
    .replace(/<<interactive_id:[^>]+>>/g, "")
    .trim();
  if (
    /\b(sair|encerrar|desativar)\s+(?:do\s+)?modo\s+demonstracao\b/.test(
      value,
    ) ||
    /^sair da demonstracao$/.test(value)
  ) {
    return { action: "exit" };
  }
  const match = value.match(
    /\bdemonstrar\s+como\s+(.+?)(?:[.!?]|$)/,
  );
  if (!match?.[1]) return null;
  const segment = match[1]
    .replace(/^uma?\s+/, "")
    .replace(/\brevenda\b(?!\s+de)/, "revenda de veículos")
    .trim()
    .slice(0, 100);
  return segment ? { action: "set", segment } : null;
}

export function demoSegmentConfirmationButtons() {
  return {
    body: "Ativar este ramo por 6 horas?",
    buttons: [
      { id: "vertical_demo:confirm", title: "Confirmar" },
      { id: "vertical_demo:cancel", title: "Cancelar" },
    ],
  };
}

export function activeDemoSegment(
  state: VerticalNamespacedState,
  nowMs = Date.now(),
): string | null {
  const demo = state.vertical_router?.demo_segment;
  if (!demo?.segment) return null;
  return new Date(demo.expires_at).getTime() > nowMs ? demo.segment : null;
}

export function withDemoModeLabel(
  text: string,
  decision: Pick<VerticalDecision, "demoMode" | "effectiveSegment">,
): string {
  if (!decision.demoMode || !decision.effectiveSegment) return text;
  const label = `Modo demonstração: ${decision.effectiveSegment}`;
  return text.startsWith(label) ? text : `${label}\n\n${text}`;
}

export function verticalAdDetailsPrompt(route: InboundVertical): string {
  return route === "veiculo"
    ? "Vou usar a primeira foto. Me mande modelo, ano, preço e os outros dados que quiser mostrar no anúncio."
    : "Vou usar a primeira foto. Me mande nome do produto, preço e condições.";
}
