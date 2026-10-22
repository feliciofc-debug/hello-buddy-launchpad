import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
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
  isVehiclePhotoEditCancel,
  parseVehiclePhotoEditInteractiveId,
  pendingVehiclePhotoEditIsActive,
  planVehiclePhotoSceneAdjustment,
  VEHICLE_PHOTO_EDIT_MAX_PAID_CALLS,
  VEHICLE_STATE_REFUSAL,
  vehiclePhotoEditInstruction,
  vehiclePhotoEditEnginePlan,
  vehiclePhotoEditIsCreativeScene,
  vehiclePhotoEditMenuButtons,
  vehiclePhotoEditMenuResponse,
  vehiclePhotoEditRenderTexts,
  vehiclePhotoEditSafetyPlan,
  vehiclePhotoEditShortcutExecutesDirectly,
  vehiclePhotoEditToolMode,
  vehiclePhotoEditUserPrompt,
  vehiclePhotoFollowUpLooksLikeEdit,
} from "./vehicle-photo-edit-wa.ts";
import { ownerMediaRouteIsVehicle } from "./owner-media-route.ts";
import {
  parseVehicleModelFixInteractiveId,
  vehicleModelCorrectionButtons,
} from "./vehicle-model-correction-wa.ts";
import { vehicleModelCorrectionStartResponse } from "./vehicle-model-fix-turn.ts";
import {
  resolveVehiclePhotoActionContext,
  vehicleInteractiveMissingPhotoReply,
} from "./vehicle-photo-action-context.ts";
import {
  inboundHasInteractiveId,
  shouldSkipOwnerMediaTextHeuristics,
} from "./vehicle-flow-interactive-guard.ts";

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
  assertEquals(menu.buttons.length, 0);
  assertEquals(
    parseVehiclePhotoEditInteractiveId(
      `<<INTERACTIVE_ID:vehicle_photo_edit:studio>>`,
    ),
    "studio",
  );
  assertEquals(vehiclePhotoEditToolMode("melhorar a luz"), "melhoria");
  assertEquals(vehiclePhotoEditToolMode("fundo de estúdio"), "cena_produto");
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
    assertEquals(
      parseVehiclePhotoActionId(
        `Tap\n<<INTERACTIVE_ID:${vehiclePhotoActionId(action)}>>`,
      ),
      action,
    );
    if (action === "edit") {
      assertEquals(
        vehiclePhotoEditMenuButtons().body,
        "Me manda o seu prompt, por texto ou áudio.",
      );
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

Deno.test("FIX-VEIC-3.1 — arte limpa pending, mas contexto salvo recupera botões", () => {
  const saved = {
    identification: sampleId!,
    media_ids: ["foto-honda-city"],
    target: "single_ad" as const,
    confirmed: true,
    confirmed_title: "Honda City",
    data: { preco: "R$ 48.900", quilometragem: "80.000 km" },
    created_at: "2026-10-22T12:00:00.000Z",
  };
  const afterArt = resolveVehiclePhotoActionContext({
    pending: null,
    saved,
    lastMediaId: "arte-gerada",
    mediaRoutes: {},
  });
  assertEquals(afterArt?.media_ids, ["foto-honda-city"]);
  assertEquals(afterArt?.confirmed_title, "Honda City");
});

Deno.test("FIX-VEIC-3.1 — toque sem contexto pede foto e não segue ao LLM", () => {
  const context = resolveVehiclePhotoActionContext({
    pending: null,
    saved: null,
    lastMediaId: "arte-sem-rota",
    mediaRoutes: {},
  });
  assertEquals(context, null);
  assertEquals(
    vehicleInteractiveMissingPhotoReply(),
    "Não encontrei a foto deste veículo. Envie a imagem novamente.",
  );
});

Deno.test("FIX-VEIC-3.1 — Editar foto pede descrição e áudio vira instrução", () => {
  const menu = vehiclePhotoEditMenuButtons();
  assertEquals(menu.body, "Me manda o seu prompt, por texto ou áudio.");
  assertEquals(menu.buttons, []);
  assertEquals(
    vehiclePhotoEditInstruction(
      "🎙️ Áudio transcrito: rua à noite com luzes da cidade",
    ),
    "rua à noite com luzes da cidade",
  );
  assert(vehiclePhotoEditIsCreativeScene("rua à noite com luzes da cidade"));
});

Deno.test("FIX-VEIC-3.4 — Editar foto pede somente um prompt", () => {
  const response = vehiclePhotoEditMenuResponse();
  assertEquals(response, {
    text: "Me manda o seu prompt, por texto ou áudio.",
  });
  assertEquals(VEHICLE_PHOTO_EDIT_MAX_PAID_CALLS, 1);
});

Deno.test("FIX-VEIC-3.4 — fallback sem recorte local usa uma chamada paga", () => {
  assertEquals(vehiclePhotoEditEnginePlan(false), {
    strategy: "single_ai_edit_fallback",
    maxPaidCalls: 1,
    usesPaidMask: false,
    usesPaidColorValidation: false,
  });
  assertEquals(vehiclePhotoEditEnginePlan(true).maxPaidCalls, 1);
});

Deno.test("FIX-VEIC-3.3 — atalho sem pending executa direto e não reabre menu", () => {
  assertEquals(vehiclePhotoEditShortcutExecutesDirectly("studio"), true);
  assertEquals(vehiclePhotoEditShortcutExecutesDirectly("enhance"), true);
  assertEquals(vehiclePhotoEditShortcutExecutesDirectly(null), false);
});

Deno.test("FIX-VEIC-3.1 — edição não herda preço/km/logo", () => {
  const prompt = vehiclePhotoEditUserPrompt("fundo de estúdio");
  assert(prompt.includes("Não use nem reaproveite preço"));
  assert(prompt.includes("quilometragem"));
  assert(prompt.includes("logo"));
  assert(!prompt.includes("48.900"));
  assert(!prompt.includes("80.000"));
  assertEquals(vehiclePhotoEditIsCreativeScene("fundo de estúdio"), true);
  assertEquals(vehiclePhotoEditRenderTexts("melhorar a luz"), []);
  assertEquals(vehiclePhotoEditRenderTexts("fundo de estúdio"), []);
  assert(!prompt.includes("Imagem ilustrativa"));
});

Deno.test("FIX-VEIC-3.2 — cenário novo parte da original; melhoria do resultado", () => {
  const base = {
    currentMediaId: "edit-estudio",
    currentUrl: "estudio.jpg",
    rootMediaId: "foto-original",
    rootUrl: "original.jpg",
  };
  const showroom = planVehiclePhotoSceneAdjustment({
    ...base,
    adjustment: "showroom com piso brilhante e paredes de vidro",
  });
  assertEquals(showroom.fromOriginal, true);
  assertEquals(showroom.sourceMediaId, "foto-original");
  assertEquals(showroom.modo, "cena_produto");
  assertEquals(showroom.preservarAmbiente, false);
  assertEquals(
    showroom.instruction,
    "showroom com piso brilhante e paredes de vidro",
  );

  const studio = planVehiclePhotoSceneAdjustment({
    ...base,
    adjustment: "fundo de estúdio neutro",
  });
  assertEquals(studio.fromOriginal, true);
  assertEquals(studio.sourceMediaId, "foto-original");

  const light = planVehiclePhotoSceneAdjustment({
    ...base,
    adjustment: "melhorar a luz e nitidez",
  });
  assertEquals(light.fromOriginal, false);
  assertEquals(light.sourceMediaId, "edit-estudio");
  assertEquals(light.modo, "melhoria");
  assertEquals(light.preservarAmbiente, true);
});

Deno.test("FIX-VEIC-3.2 — rota veículo reconhece foto raiz em vehicle_media_ids", () => {
  assertEquals(
    ownerMediaRouteIsVehicle(
      {
        media_routes: {
          "arte-1": {
            route: "veiculo",
            origin: "botao_dono",
            vehicle_media_ids: ["foto-honda"],
            updated_at: "2026-10-22T12:00:00.000Z",
          },
        },
      },
      "edit-estudio",
      "foto-honda",
    ),
    true,
  );
});

Deno.test("FIX-VEIC-3.3 — pintura pode ser realçada sem autorizar alteração de estado", () => {
  const allowed = vehiclePhotoEditSafetyPlan(
    "deixar a pintura mais nova e brilhante, com reflexos",
  );
  assertEquals(allowed.refused, false);
  assertEquals(
    allowed.safeInstruction,
    "deixar a pintura mais nova e brilhante, com reflexos",
  );
  const prompt = vehiclePhotoEditUserPrompt(allowed.safeInstruction);
  assert(prompt.includes("aspecto encerado/polido"));
  assert(prompt.includes("preserve rigorosamente o tom/cor original"));
});

Deno.test("FIX-VEIC-3.3 — avarias e troca de cor são removidas do pedido", () => {
  const mixed = vehiclePhotoEditSafetyPlan(
    "melhorar a luz e tirar os riscos da porta",
  );
  assertEquals(mixed.refused, true);
  assertEquals(mixed.safeInstruction, "melhorar a luz");
  assertEquals(
    VEHICLE_STATE_REFUSAL,
    "Realcei a pintura e o brilho. Não removo avarias nem mudo a cor para não enganar o comprador.",
  );
  const forbidden = vehiclePhotoEditSafetyPlan("trocar a cor e as rodas");
  assertEquals(forbidden.refused, true);
  assertEquals(
    forbidden.safeInstruction,
    "realçar a pintura e o brilho sem mudar a cor, mantendo todas as avarias visíveis",
  );
});

Deno.test("FIX-VEIC-3.3 — texto imediato de imagem vira ajuste", () => {
  assert(vehiclePhotoFollowUpLooksLikeEdit(
    "manter a cor original nessa última foto e melhorar o reflexo",
  ));
  assertEquals(
    vehiclePhotoFollowUpLooksLikeEdit("qual o preço do carro?"),
    false,
  );
});

Deno.test("FIX-VEIC-3.1 — edição pendente expira em 30 min e cancela", () => {
  const now = Date.parse("2026-10-22T12:40:00.000Z");
  assert(pendingVehiclePhotoEditIsActive({
    media_id: "foto-1",
    created_at: "2026-10-22T12:11:00.000Z",
  }, now));
  assertEquals(
    pendingVehiclePhotoEditIsActive({
      media_id: "foto-1",
      created_at: "2026-10-22T12:09:59.000Z",
    }, now),
    false,
  );
  assert(isVehiclePhotoEditCancel("cancelar"));
});

for (
  const interactiveText of [
    "Postar nas redes\n<<INTERACTIVE_ID:vehicle_photo_action:post>>",
    "Editar foto\n<<INTERACTIVE_ID:vehicle_photo_action:edit>>",
  ]
) {
  Deno.test(`FIX-VEIC-3.1 — forced image bloqueado: ${interactiveText.split("\n")[0]}`, () => {
    assert(inboundHasInteractiveId(interactiveText));
    assert(shouldSkipOwnerMediaTextHeuristics(interactiveText));
  });
}
