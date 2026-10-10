import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  activeDemoSegment,
  activePendingVerticalRoute,
  applyVerticalStatePatch,
  businessSegmentButtons,
  demoSegmentConfirmationButtons,
  explicitVerticalIntent,
  isAutomotiveTenant,
  migrateVerticalState,
  parseDemoSegmentCommand,
  parseVerticalVisionResult,
  resolveVertical,
  scopedVerticalState,
  verticalAdDetailsPrompt,
  verticalChoiceButtons,
  withDemoModeLabel,
} from "./vertical-router.ts";
import {
  generalSpecialistAllowsTool,
  generalSpecialistPhotoButtons,
  generalSpecialistPrompt,
  generalState,
} from "./vertical-general/index.ts";
import {
  vehicleSpecialistAllowsTool,
  vehicleSpecialistPhotoButtons,
  vehicleState,
} from "./vertical-vehicle/index.ts";

Deno.test("pedidos explícitos escolhem o especialista correto", () => {
  for (
    const text of [
      "quero um carrossel do carro",
      "consulta a FIPE",
      "qual a fipi do corolla 2019",
      "anúncio do veículo",
      "é para repasse",
    ]
  ) {
    assertEquals(explicitVerticalIntent(text)?.route, "veiculo");
  }
  assertEquals(
    explicitVerticalIntent("troca o fundo da caneca")?.route,
    "geral",
  );
  assertEquals(
    explicitVerticalIntent(
      "<<INTERACTIVE_ID:vehicle_identification:confirm>>",
    )?.route,
    "veiculo",
  );
});

Deno.test("pendente ativo retoma a vertical certa sem sequestrar pedido explícito", () => {
  const now = Date.parse("2026-10-07T15:00:00.000Z");
  const state = {
    vehicle: {
      pending_vehicle_identification: {
        created_at: "2026-10-07T14:55:00.000Z",
      },
    },
    general: {},
  };
  assertEquals(activePendingVerticalRoute(state, now), "veiculo");
  assertEquals(
    resolveVertical({
      isAdmin: true,
      pendingRoute: activePendingVerticalRoute(state, now),
      text: "2014, 80 mil km, R$ 45.900",
    }).route,
    "veiculo",
  );
  assertEquals(
    resolveVertical({
      isAdmin: true,
      pendingRoute: "veiculo",
      text: "edita essa foto e tira o fundo",
    }).route,
    "geral",
  );
  assertEquals(
    activePendingVerticalRoute(state, now + 31 * 60 * 1000),
    null,
  );
  assertEquals(
    activePendingVerticalRoute({
      vehicle: {},
      general: {
        pending_single_photo: {
          created_at: "2026-10-07T14:59:00.000Z",
        },
      },
    }, now),
    "geral",
  );
});

Deno.test("perfil da revenda é viés de veículo; hospital e loja são gerais", () => {
  assert(isAutomotiveTenant("Revenda de veículos seminovos"));
  assertEquals(
    resolveVertical({ tenantSegment: "Revenda de veículos" }).route,
    "veiculo",
  );
  assertEquals(resolveVertical({ tenantSegment: "Hospital" }).route, "geral");
  assertEquals(
    resolveVertical({ tenantSegment: "Loja de presentes" }).route,
    "geral",
  );
});

Deno.test("visão separa carro de caneca e baixa confiança pede confirmação", () => {
  const vehicle = resolveVertical({
    tenantSegment: "Revenda de veículos",
    vision: { route: "veiculo", confidence: 0.98 },
  });
  assertEquals(vehicle.route, "veiculo");
  assertEquals(vehicle.confidence, 0.98);
  assertEquals(vehicle.needsConfirmation, false);
  assertEquals(
    resolveVertical({
      tenantSegment: "Revenda",
      vision: { route: "geral", confidence: 0.99 },
    }).route,
    "geral",
  );
  assertEquals(
    resolveVertical({
      tenantSegment: "Revenda de veículos",
      vision: { route: "veiculo", confidence: 0.4 },
    }).needsConfirmation,
    true,
  );
  assertEquals(
    verticalChoiceButtons().buttons.map((button) => button.title),
    ["É um veículo", "É outro produto"],
  );
});

Deno.test("ramos automotivos adjacentes não são classificados como revenda", () => {
  for (
    const segment of [
      "Consórcio de veículos",
      "Seguradora automotiva",
      "Financeira de carros",
      "Autoescola",
      "Oficina automotiva",
      "Lava-jato",
      "Locadora de veículos",
      "Auto center e auto peças",
    ]
  ) {
    assertEquals(isAutomotiveTenant(segment), false, segment);
  }
});

Deno.test("parser de visão aceita somente classificação factual", () => {
  assertEquals(
    parseVerticalVisionResult(
      '{"route":"geral","confidence":0.97,"reason":"garrafa termica"}',
    ),
    { route: "geral", confidence: 0.97, reason: "garrafa termica" },
  );
  assertEquals(parseVerticalVisionResult("uma foto de carro"), null);
});

Deno.test("migração separa pendentes legados por vertical", () => {
  const migrated = migrateVerticalState({
    pending_carrossel_veiculo: { stage: "collecting" },
    pending_vehicle_photo_batch: { photos: ["carro"] },
    pending_single_photo: { media_id: "garrafa" },
    pending_carousel: { tema: "caneca" },
    last_media_interaction: { media_id: "atual" },
  });
  assert(migrated.changed);
  assertEquals(
    (migrated.state.vehicle?.pending_carrossel_veiculo as { stage: string })
      .stage,
    "collecting",
  );
  assertEquals(
    (migrated.state.general?.pending_single_photo as { media_id: string })
      .media_id,
    "garrafa",
  );
  assertEquals(
    (migrated.state.last_media_interaction as { media_id: string }).media_id,
    "atual",
  );
  assertEquals(migrated.state.pending_carrossel_veiculo, undefined);
  assertEquals(migrated.state.pending_single_photo, undefined);
});

Deno.test("estado de um especialista nunca expõe memória do outro", () => {
  const root = {
    vehicle: {
      pending_carrossel_veiculo: { photos: ["citroen"] },
      last_anuncio: { titulo: "Citroën" },
    },
    general: {
      pending_single_photo: { media_id: "garrafa" },
      pending_carousel: { tema: "caneca" },
    },
    last_media_interaction: { media_id: "garrafa" },
  };
  const general = scopedVerticalState(root, "geral");
  const vehicle = scopedVerticalState(root, "veiculo");
  assertEquals(general.pending_carrossel_veiculo, undefined);
  assertEquals(general.last_anuncio, undefined);
  assertEquals(vehicle.pending_single_photo, undefined);
  assertEquals(vehicle.pending_carousel, undefined);
  assertEquals(
    (general.last_media_interaction as { media_id: string }).media_id,
    "garrafa",
  );
});

Deno.test("carrossel de veículo aberto mais garrafa mantém estados isolados", () => {
  const root = {
    vehicle: {
      pending_carrossel_veiculo: { photos: ["citroen"], stage: "collecting" },
    },
    general: {},
  };
  const general = scopedVerticalState(root, "geral");
  const persisted = applyVerticalStatePatch(general, {
    pending_single_photo: { media_id: "garrafa", stage: "actions" },
  });
  assertEquals(
    (persisted.vehicle?.pending_carrossel_veiculo as { photos: string[] })
      .photos,
    ["citroen"],
  );
  assertEquals(
    (persisted.general?.pending_single_photo as { media_id: string }).media_id,
    "garrafa",
  );
  assertEquals(vehicleState(persisted).pending_single_photo, undefined);
  assertEquals(generalState(persisted).pending_carrossel_veiculo, undefined);
});

Deno.test("especialistas expõem somente ferramentas e botões da própria vertical", () => {
  assertEquals(generalSpecialistAllowsTool("consultar_fipe"), false);
  assertEquals(generalSpecialistAllowsTool("criar_carrossel"), true);
  assertEquals(vehicleSpecialistAllowsTool("consultar_fipe"), true);
  assertEquals(vehicleSpecialistAllowsTool("criar_carrossel"), false);
  assertEquals(
    generalSpecialistPhotoButtons().buttons.map((button) => button.title),
    ["Anúncio", "Editar imagem", "Post nas redes"],
  );
  assertEquals(
    vehicleSpecialistPhotoButtons().buttons.map((button) => button.title),
    ["Anúncio", "Carrossel", "Nada agora"],
  );
});

Deno.test("consórcio com foto de carro permanece no especialista geral", () => {
  const decision = resolveVertical({
    tenantSegment: "Consórcio Ademicon",
    vision: { route: "veiculo", confidence: 0.99 },
  });
  assertEquals(decision.route, "geral");
  assertEquals(decision.explicitFipe, false);
  assertEquals(decision.reason, "ramo_nao_automotivo");
});

Deno.test("consórcio acessa FIPE somente por pedido explícito", () => {
  const decision = resolveVertical({
    tenantSegment: "Consórcio",
    text: "qual a FIPE do Onix 2022?",
  });
  assertEquals(decision.route, "geral");
  assertEquals(decision.explicitFipe, true);
  assertEquals(decision.reason, "fipe_explicita_fora_revenda");
});

Deno.test("revenda usa visão para separar carro de caneca", () => {
  assertEquals(
    resolveVertical({
      tenantSegment: "Revenda de veículos",
      vision: { route: "veiculo", confidence: 0.98 },
    }).route,
    "veiculo",
  );
  assertEquals(
    resolveVertical({
      tenantSegment: "Revenda de veículos",
      vision: { route: "geral", confidence: 0.98 },
    }).route,
    "geral",
  );
});

Deno.test("tenant sem ramo recebe pergunta única por botões", () => {
  const decision = resolveVertical({
    tenantSegment: null,
    vision: { route: "veiculo", confidence: 0.99 },
  });
  assertEquals(decision.needsSegmentConfirmation, true);
  assertEquals(
    businessSegmentButtons().buttons.map((button) => button.title),
    ["Revenda de veículos", "Outro ramo"],
  );
});

Deno.test("admin sem ramo permanece automático pela visão", () => {
  assertEquals(
    resolveVertical({
      isAdmin: true,
      tenantSegment: null,
      vision: { route: "veiculo", confidence: 0.98 },
    }).route,
    "veiculo",
  );
  assertEquals(
    resolveVertical({
      isAdmin: true,
      tenantSegment: null,
      vision: { route: "geral", confidence: 0.98 },
    }).route,
    "geral",
  );
});

Deno.test("modo demonstração fixa ramo por seis horas e expira", () => {
  const now = Date.parse("2026-10-07T13:00:00.000Z");
  const demo = {
    segment: "consórcio",
    expires_at: "2026-10-07T19:00:00.000Z",
  };
  const active = resolveVertical({
    isAdmin: true,
    demoSegment: demo,
    vision: { route: "veiculo", confidence: 0.99 },
    nowMs: now,
  });
  assertEquals(active.route, "geral");
  assertEquals(active.demoMode, true);
  const expired = resolveVertical({
    isAdmin: true,
    demoSegment: demo,
    vision: { route: "veiculo", confidence: 0.99 },
    nowMs: Date.parse("2026-10-07T19:00:00.001Z"),
  });
  assertEquals(expired.route, "veiculo");
  assertEquals(expired.demoMode, undefined);
  assertEquals(
    withDemoModeLabel("Recebi a foto.", active),
    "Modo demonstração: consórcio\n\nRecebi a foto.",
  );
});

Deno.test("comandos de demonstração e confirmação são determinísticos", () => {
  assertEquals(parseDemoSegmentCommand("demonstrar como consórcio"), {
    action: "set",
    segment: "consorcio",
  });
  assertEquals(parseDemoSegmentCommand("sair da demonstração"), {
    action: "exit",
  });
  assertEquals(
    demoSegmentConfirmationButtons().buttons.map((button) => button.title),
    ["Confirmar", "Cancelar"],
  );
  assertEquals(
    activeDemoSegment({
      vertical_router: {
        demo_segment: {
          segment: "seguradora",
          expires_at: "2026-10-07T19:00:00.000Z",
        },
      },
    }, Date.parse("2026-10-07T18:59:59.000Z")),
    "seguradora",
  );
});

Deno.test("comando de demonstração não altera decisão de conta cliente", () => {
  const command = parseDemoSegmentCommand(
    "demonstrar como revenda de veículos",
  );
  assertEquals(command?.action, "set");
  const decision = resolveVertical({
    isAdmin: false,
    tenantSegment: "Consórcio",
    text: "demonstrar como revenda de veículos",
    vision: { route: "veiculo", confidence: 0.99 },
  });
  assertEquals(decision.route, "geral");
});

Deno.test("especialista geral recebe contexto do ramo sem transformar carro em venda", () => {
  const prompt = generalSpecialistPrompt("Consórcio Ademicon");
  assert(
    prompt.includes("Contexto obrigatório do negócio: Consórcio Ademicon"),
  );
  assert(prompt.includes("não ofereça FIPE, km, repasse"));
  assert(prompt.includes("Não ofereça nem consulte FIPE automaticamente"));
  assert(
    generalSpecialistPrompt("Consórcio", true).includes(
      "consulta de FIPE foi pedida explicitamente",
    ),
  );
});

Deno.test("pedido de dados do anúncio respeita a vertical", () => {
  assertEquals(
    verticalAdDetailsPrompt("geral"),
    "Vou usar a primeira foto. Me mande nome do produto, preço e condições.",
  );
  assert(
    verticalAdDetailsPrompt("veiculo").includes("modelo, ano, preço"),
  );
});
