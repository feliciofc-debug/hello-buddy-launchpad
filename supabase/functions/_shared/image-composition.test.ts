import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
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
