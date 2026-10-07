import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  singlePhotoActionButtons,
  singlePhotoFormatButtons,
} from "./single-photo-flow.ts";

Deno.test("foto única nova oferece análise acionável por botões", () => {
  assertEquals(
    singlePhotoActionButtons().buttons.map((button) => button.title),
    ["Anúncio", "Editar imagem", "Post nas redes"],
  );
});

Deno.test("pergunta de formato não repete o corpo dos botões", () => {
  assertEquals(singlePhotoFormatButtons().body, "Selecione uma opção.");
  assertEquals(
    singlePhotoFormatButtons().buttons.map((button) => button.title),
    ["Feed", "Story"],
  );
});
