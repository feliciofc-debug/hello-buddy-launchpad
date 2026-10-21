import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  ownerPhotoConfirmButtons,
  ownerPhotoConfirmedProductTitle,
  ownerProductVisionConfirmMessage,
  ownerRepeatedVisionConfirmMessage,
  ownerUncertainVisionConfirmMessage,
  parseOwnerPhotoConfirmInteractiveId,
  productAdDataPrompt,
} from "./owner-photo-confirm.ts";

Deno.test("produto — mensagem com descrição da visão e botões", () => {
  const msg = ownerProductVisionConfirmMessage(
    "tapetes automotivos e capas de banco em várias cores",
  );
  assertStringIncludes(msg, "Vi tapetes automotivos");
  assertStringIncludes(msg, "É isso?");
  assertEquals(
    ownerPhotoConfirmButtons().buttons.map((b) => b.title),
    ["Sim, é produto", "É um veículo", "Corrigir"],
  );
});

Deno.test("incerto — descreve antes de perguntar veículo ou produto", () => {
  const msg = ownerUncertainVisionConfirmMessage("objetos sobre uma mesa");
  assertStringIncludes(msg, "Não tenho certeza");
  assertStringIncludes(msg, "Vi objetos sobre uma mesa");
});

Deno.test("foto repetida — repete descrição salva", () => {
  const product = ownerRepeatedVisionConfirmMessage(
    "Três desodorantes sobre bancada branca",
    "produto",
  );
  assertStringIncludes(product, "já tinha me mandado");
  assertStringIncludes(product, "Três desodorantes");
  const vehicle = ownerRepeatedVisionConfirmMessage(
    "SUV cinza em estacionamento",
    "veiculo",
  );
  assertStringIncludes(vehicle, "Vi SUV cinza");
  assertStringIncludes(vehicle, "Confirma?");
});

Deno.test("parser de botões owner_photo", () => {
  assertEquals(
    parseOwnerPhotoConfirmInteractiveId(
      "<<INTERACTIVE_ID:owner_photo:confirm_product>>",
    ),
    "confirm_product",
  );
  assertEquals(
    parseOwnerPhotoConfirmInteractiveId(
      "<<INTERACTIVE_ID:owner_photo:confirm_vehicle>>",
    ),
    "confirm_vehicle",
  );
});

Deno.test("título confirmado vira base do anúncio de produto", () => {
  assertEquals(
    ownerPhotoConfirmedProductTitle("Tapetes e capas coloridas"),
    "Tapetes e capas coloridas",
  );
  assertEquals(
    ownerPhotoConfirmedProductTitle("tapetes", "Kit tapete premium"),
    "Kit tapete premium",
  );
  assertStringIncludes(
    productAdDataPrompt("Tapetes automotivos"),
    "«Tapetes automotivos»",
  );
});
