import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  hasExplicitSceneDescription,
  sceneEditDirective,
} from "./image-edit-instruction.ts";

Deno.test("cenário descrito pelo usuário é a instrução principal", () => {
  const request =
    "Troca o cenário desta foto: mesa de café da manhã de madeira clara";
  const directive = sceneEditDirective(request);
  assert(hasExplicitSceneDescription(request));
  assert(directive.includes(request));
  assert(directive.toLowerCase().includes("instrução principal"));
  assert(directive.includes("Não substitua"));
});

Deno.test("estúdio padrão só é usado quando não existe descrição", () => {
  assertEquals(hasExplicitSceneDescription("melhora essa foto"), false);
  assert(sceneEditDirective("melhora essa foto").includes("CENÁRIO PADRÃO"));
});
