import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  applyVerticalStatePatch,
  explicitVerticalIntent,
  isAutomotiveTenant,
  migrateVerticalState,
  parseVerticalVisionResult,
  resolveVertical,
  scopedVerticalState,
  verticalChoiceButtons,
} from "./vertical-router.ts";
import { generalState } from "./vertical-general/index.ts";
import { vehicleState } from "./vertical-vehicle/index.ts";

Deno.test("pedidos explícitos escolhem o especialista correto", () => {
  for (
    const text of [
      "quero um carrossel do carro",
      "consulta a FIPE",
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
  assertEquals(
    resolveVertical({
      tenantSegment: "Loja",
      vision: { route: "veiculo", confidence: 0.98 },
    }),
    {
      route: "veiculo",
      confidence: 0.98,
      reason: "visao",
      needsConfirmation: false,
    },
  );
  assertEquals(
    resolveVertical({
      tenantSegment: "Revenda",
      vision: { route: "geral", confidence: 0.99 },
    }).route,
    "geral",
  );
  assertEquals(
    resolveVertical({
      tenantSegment: "Loja",
      vision: { route: "veiculo", confidence: 0.4 },
    }).needsConfirmation,
    true,
  );
  assertEquals(
    verticalChoiceButtons().buttons.map((button) => button.title),
    ["É um veículo", "É outro produto"],
  );
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
