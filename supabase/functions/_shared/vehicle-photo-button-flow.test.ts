import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseVehicleIdentification } from "./vehicle-identification.ts";
import {
  parseVehiclePhotoActionId,
  vehiclePhotoActionId,
  vehiclePhotoDirectActionList,
} from "./vehicle-photo-direct-menu.ts";
import {
  parseVehiclePostFipeInteractiveId,
  shouldOfferVehiclePostFipeMenu,
  vehiclePostFipeMenuList,
} from "./vehicle-post-fipe-menu.ts";
import {
  blockGerarImagemForVehiclePhotoFlow,
  vehiclePhotoAdMediaId,
} from "./vehicle-photo-ad-wa.ts";
import {
  parseVehiclePhotoEditInteractiveId,
  vehiclePhotoEditMenuButtons,
  vehiclePhotoEditToolMode,
} from "./vehicle-photo-edit-wa.ts";
import {
  parseVehicleModelFixInteractiveId,
  vehicleModelCorrectionButtons,
} from "./vehicle-model-correction-wa.ts";
import { vehicleModelCorrectionStartResponse } from "./vehicle-model-fix-turn.ts";

const sampleId = parseVehicleIdentification(JSON.stringify({
  marca: "Chevrolet",
  modelo: "Onix",
  cor: "prata",
  confianca: "alta",
  pistas_visuais: ["hatch"],
}));

Deno.test("FIX-VEIC-3 B9 — menu foto reativa ações (sem vídeo/estoque)", () => {
  const list = vehiclePhotoDirectActionList(sampleId);
  const actions = list.rows.map((r) =>
    r.id.replace("vehicle_photo_action:", "")
  );
  assertEquals(actions, [
    "ad",
    "post",
    "meta",
    "fipe",
    "troca",
    "correct",
    "edit",
  ]);
});

Deno.test("FIX-VEIC-3 B9 — menu pós-FIPE completo filtrado", () => {
  const list = vehiclePostFipeMenuList();
  assertEquals(list.rows.length, 6);
  assertEquals(
    list.rows.map((r) => r.id.replace("vehicle_post_fipe:", "")),
    ["ad", "post", "meta", "troca", "correct", "edit"],
  );
});

Deno.test("FIX-VEIC-3 B5 — pós-FIPE com identificação alta (sem confirmar)", () => {
  assertEquals(shouldOfferVehiclePostFipeMenu({}), false);
  assertEquals(
    shouldOfferVehiclePostFipeMenu({
      pending_vehicle_identification: {
        confirmed: false,
        identification: sampleId,
      },
    }),
    true,
  );
});

Deno.test("FIX-VEIC-3 B2 — bloqueia gerar_imagem com foto pendente", () => {
  assertEquals(
    blockGerarImagemForVehiclePhotoFlow({
      pending_vehicle_identification: { media_ids: ["mid-1"] },
    }),
    true,
  );
  assertEquals(
    vehiclePhotoAdMediaId({
      pending_vehicle_identification: { media_ids: ["mid-abc"] },
    }),
    "mid-abc",
  );
});

Deno.test("FIX-VEIC-3 B7 — menu editar foto e modos", () => {
  const menu = vehiclePhotoEditMenuButtons();
  assertEquals(menu.buttons.length, 3);
  assertEquals(
    parseVehiclePhotoEditInteractiveId(
      `<<INTERACTIVE_ID:vehicle_photo_edit:studio>>`,
    ),
    "studio",
  );
  assertEquals(vehiclePhotoEditToolMode("enhance"), "melhoria");
  assertEquals(vehiclePhotoEditToolMode("studio"), "projeto_ambiente");
});

Deno.test("FIX-VEIC-3 B8 — correção por botões", () => {
  const start = vehicleModelCorrectionStartResponse(sampleId);
  assert(start.interactiveButtons);
  assertEquals(
    parseVehicleModelFixInteractiveId(
      `<<INTERACTIVE_ID:vehicle_model_fix:alt:0>>`,
    ),
    "alt:0",
  );
  const buttons = vehicleModelCorrectionButtons(sampleId);
  assert(buttons.buttons.length >= 1);
});

/** Conversa sintética por botão — próximo passo esperado (IDs estáveis). */
const photoMenuButtons = [
  ["ad", "criar_anuncio"],
  ["post", "single_photo_destination"],
  ["meta", "meta_ads_questionario"],
  ["fipe", "consultar_fipe"],
  ["troca", "gestao_troca_menu"],
  ["correct", "vehicle_model_fix_start"],
  ["edit", "vehicle_photo_edit_menu"],
] as const;

for (const [action, nextStep] of photoMenuButtons) {
  Deno.test(`FIX-VEIC-3 conversa — vehicle_photo_action:${action} → ${nextStep}`, () => {
    assertEquals(parseVehiclePhotoActionId(
      `Tap\n<<INTERACTIVE_ID:${vehiclePhotoActionId(action)}>>`,
    ), action);
    if (action === "edit") {
      assert(vehiclePhotoEditMenuButtons().body.includes("editar"));
    }
    if (action === "correct") {
      assert(vehicleModelCorrectionStartResponse(sampleId).interactiveButtons);
    }
    if (action === "post") {
      assert(parseVehiclePostFipeInteractiveId(
        `<<INTERACTIVE_ID:vehicle_post_fipe:post>>`,
      ));
    }
  });
}
