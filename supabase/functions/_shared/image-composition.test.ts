import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  IMAGE_COMPOSITION_ESTIMATED_COST_USD,
  IMAGE_COMPOSITION_MODEL,
  IMAGE_COMPOSITION_MODELS,
  isExplicitTwoImageCompositionRequest,
  isImageCompositionIntent,
} from "./image-composition.ts";

Deno.test("mesa com uma foto é edição, não pedido explícito de composição", () => {
  const text = "Edita essa foto: coloca numa mesa de café da manhã bem bonita";
  assertEquals(isImageCompositionIntent(text), true);
  assertEquals(isExplicitTwoImageCompositionRequest(text), false);
});

Deno.test("pedido explícito para juntar duas imagens é composição", () => {
  assertEquals(
    isExplicitTwoImageCompositionRequest(
      "junta essas duas fotos e coloca o lustre na sala",
    ),
    true,
  );
});

Deno.test("lustre na sala continua candidato quando existem duas fotos", () => {
  assertEquals(
    isImageCompositionIntent("coloca esse lustre na sala"),
    true,
  );
});

Deno.test("composição criativa usa Pro com fallback Flash", () => {
  assertEquals(IMAGE_COMPOSITION_MODEL, "google/gemini-3-pro-image");
  assertEquals(IMAGE_COMPOSITION_MODELS, [
    "google/gemini-3-pro-image",
    "google/gemini-3.1-flash-image",
  ]);
  assertEquals(IMAGE_COMPOSITION_ESTIMATED_COST_USD["2K"] >
    IMAGE_COMPOSITION_ESTIMATED_COST_USD["1K"], true);
});
