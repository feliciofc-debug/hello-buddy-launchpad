import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  automotiveProductSinglePhotoSnapshot,
  traditionalGeneralSinglePhotoSnapshot,
} from "./owner-general-photo-offer.ts";

/** Snapshot alinhado à BASE 61ecb57b (AMZ tradicional). */
const BASE_TRADITIONAL = {
  text: "Recebi a foto. Estou vendo: Camiseta azul dobrada sobre a mesa",
  buttonIds: ["single_photo:ad", "single_photo:edit", "single_photo:post"],
  buttonTitles: ["Anúncio", "Editar imagem", "Post nas redes"],
  stage: "actions",
} as const;

Deno.test("tenant não automotivo + produto → igual BASE 61ecb57b", () => {
  const snap = traditionalGeneralSinglePhotoSnapshot(
    "Camiseta azul dobrada sobre a mesa",
  );
  assertEquals(snap.stage, BASE_TRADITIONAL.stage);
  assertEquals(snap.text, BASE_TRADITIONAL.text);
  assertEquals(snap.buttonIds, [...BASE_TRADITIONAL.buttonIds]);
  assertEquals(snap.buttonTitles, [...BASE_TRADITIONAL.buttonTitles]);
});

Deno.test("FOTO-PRODUTO — tenant revenda + xícara segue direto para ações", () => {
  const snap = automotiveProductSinglePhotoSnapshot(
    "Esta é uma foto real de produto apresentando uma xícara de porcelana branca vazia sobre uma mesa.",
    false,
  );
  assertEquals(snap.stage, "actions");
  assertEquals(
    snap.text,
    "Recebi a foto da xícara de porcelana branca vazia. O que você quer fazer?",
  );
  assertEquals(snap.buttonIds, [
    "single_photo:post",
    "single_photo:edit",
    "single_photo:ad",
  ]);
  assertEquals(snap.buttonTitles, [
    "Postar nas redes",
    "Editar foto",
    "Criar anúncio",
  ]);
  assertEquals(snap.text.includes("foto real"), false);
  assertEquals(snap.buttonTitles.includes("É um veículo"), false);
});

Deno.test("FOTO-PRODUTO — processor usa ações de produto nos dois caminhos", async () => {
  const source = await Deno.readTextFile(
    new URL("../whatsapp-cloud-inbound-processor/index.ts", import.meta.url),
  );
  assertEquals(
    [...source.matchAll(/buttons: automotiveProductPhotoButtons\(\)/g)]
      .length >=
      2,
    true,
  );
  assertEquals(
    [...source.matchAll(/stage: automotive\.stage/g)].length >= 2,
    true,
  );
});
