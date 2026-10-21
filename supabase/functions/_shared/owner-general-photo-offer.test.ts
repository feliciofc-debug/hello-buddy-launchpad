import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  automotiveProductSinglePhotoSnapshot,
  traditionalGeneralSinglePhotoSnapshot,
} from "./owner-general-photo-offer.ts";

/** Snapshot alinhado à BASE 61ecb57b (AMZ tradicional). */
const BASE_TRADITIONAL = {
  text:
    "Recebi a foto. Estou vendo: Camiseta azul dobrada sobre a mesa",
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

Deno.test("tenant revenda + tapete → confirm_vision", () => {
  const snap = automotiveProductSinglePhotoSnapshot(
    "tapetes automotivos e capas de banco em várias cores",
    false,
  );
  assertEquals(snap.stage, "confirm_vision");
  assertEquals(
    snap.text,
    "Vi tapetes automotivos e capas de banco em várias cores. É isso?",
  );
  assertEquals(snap.buttonIds, [
    "owner_photo:confirm_product",
    "owner_photo:confirm_vehicle",
    "owner_photo:correct",
  ]);
});
