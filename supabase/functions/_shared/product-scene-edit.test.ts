import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  combineSceneInstructions,
  estimatedProductSceneCostUsd,
  PRODUCT_SCENE_FLASH_MODEL,
  PRODUCT_SCENE_IMAGE_MODELS,
  PRODUCT_SCENE_PRO_MODEL,
  planProductSceneAdjustment,
  productSceneScaleDirective,
  sceneAdjustmentRequiresRegeneration,
} from "./product-scene-edit.ts";

Deno.test("mudança de objeto ou composição regenera, ajuste pequeno edita anterior", () => {
  assert(sceneAdjustmentRequiresRegeneration(
    "troque a cafeteira por uma máquina profissional maior",
  ));
  assert(sceneAdjustmentRequiresRegeneration(
    "deixe a xícara menor e reposicione sob o bico",
  ));
  assertEquals(sceneAdjustmentRequiresRegeneration("deixa mais claro"), false);
  assertEquals(sceneAdjustmentRequiresRegeneration("tira o guardanapo"), false);
});

Deno.test("ajustes de cena são acumulados sem perder o pedido original", () => {
  const combined = combineSceneInstructions(
    "cafeteira prata com café caindo na xícara",
    "troque a máquina por uma profissional e reduza a xícara",
  );
  assertStringIncludes(combined, "cafeteira prata");
  assertStringIncludes(combined, "AJUSTE ADICIONAL OBRIGATÓRIO");
  assertStringIncludes(combined, "reduza a xícara");
});

Deno.test("mudança de objeto usa foto original e ajuste pequeno usa resultado", () => {
  const base = {
    previousRequest: "cafeteira prata com xícara sob o bico",
    currentMediaId: "generated",
    currentUrl: "generated.jpg",
    originalMediaId: "original",
    originalUrl: "original.jpg",
  };
  const regenerated = planProductSceneAdjustment({
    ...base,
    adjustment: "troque a máquina por uma profissional maior",
  });
  assertEquals(regenerated.regenerate, true);
  assertEquals(regenerated.sourceMediaId, "original");
  assertEquals(regenerated.sourceUrl, "original.jpg");
  assertStringIncludes(regenerated.instruction, "cafeteira prata");
  assertStringIncludes(regenerated.instruction, "profissional maior");

  const small = planProductSceneAdjustment({
    ...base,
    adjustment: "deixa mais claro",
  });
  assertEquals(small.regenerate, false);
  assertEquals(small.sourceMediaId, "generated");
  assertEquals(small.sourceUrl, "generated.jpg");
  assertEquals(small.instruction, "deixa mais claro");
});

Deno.test("composição usa Pro primeiro e Flash como fallback", () => {
  assertEquals(PRODUCT_SCENE_IMAGE_MODELS, [
    PRODUCT_SCENE_PRO_MODEL,
    PRODUCT_SCENE_FLASH_MODEL,
  ]);
  assert(
    estimatedProductSceneCostUsd(PRODUCT_SCENE_PRO_MODEL, 2) >
      estimatedProductSceneCostUsd(PRODUCT_SCENE_FLASH_MODEL, 2),
  );
});

Deno.test("prompt de cena exige escala real e física plausível", () => {
  const directive = productSceneScaleDirective();
  assertStringIncludes(directive, "proporções reais");
  assertStringIncludes(directive, "xícara tem cerca de 10 cm");
  assertStringIncludes(directive, "máquina de expresso profissional");
  assertStringIncludes(
    directive,
    "fotografia realista de produto, com proporções reais, sem aparência artificial",
  );
});
