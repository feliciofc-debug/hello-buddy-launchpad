import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isDocumentGateNegativeReply,
  jarvisMenuSetsVehiclePhotoExpectation,
  ownerExpectsMarketingVehiclePhoto,
  ownerPhotoRoutingCaption,
  ownerSkipsDocumentPhotoGate,
  respostaMidiaSalvaSemCodigos,
} from "./owner-vehicle-photo-routing.ts";

Deno.test("FOTO-CARRO — Não é documento zera legenda de roteamento", () => {
  assertEquals(isDocumentGateNegativeReply("Não é documento"), true);
  assertEquals(
    ownerPhotoRoutingCaption("Não é documento", {
      liberatedFromDocumentGate: true,
    }),
    "",
  );
  assertEquals(ownerPhotoRoutingCaption("Não é documento"), "");
});

Deno.test("FOTO-CARRO — marketing recente pula portão de documento", () => {
  const now = Date.now();
  assertEquals(
    ownerSkipsDocumentPhotoGate({
      pending_marketing_vehicle_photo: {
        created_at: new Date(now - 60_000).toISOString(),
        source: "jarvis_menu:grupo:marketing",
      },
    }, now),
    true,
  );
  assertEquals(
    ownerExpectsMarketingVehiclePhoto({
      pending_marketing_vehicle_photo: {
        created_at: new Date(now - 20 * 60_000).toISOString(),
        source: "jarvis_menu:lista:marketing:postar_redes",
      },
    }, now),
    false,
  );
});

Deno.test("FOTO-CARRO — menu Jarvis marketing marca próxima foto", () => {
  assertEquals(
    jarvisMenuSetsVehiclePhotoExpectation("jarvis_menu:grupo:marketing"),
    true,
  );
  assertEquals(
    jarvisMenuSetsVehiclePhotoExpectation(
      "jarvis_menu:lista:marketing:postar_redes",
    ),
    true,
  );
  assertEquals(
    jarvisMenuSetsVehiclePhotoExpectation("jarvis_menu:item:gerar-arte"),
    true,
  );
  assertEquals(
    jarvisMenuSetsVehiclePhotoExpectation("jarvis_menu:grupo:gestao"),
    false,
  );
});

Deno.test("FOTO-CARRO — resposta sem ID da mídia", () => {
  const text = respostaMidiaSalvaSemCodigos(
    [{ tipo: "foto" }],
    "SUV preto em pátio",
  );
  assertEquals(text.includes("ID da mídia"), false);
  assertEquals(text.includes("/midias"), true);
});

Deno.test("FOTO-CARRO — processor desvia em freshLibrary quando contexto não está vazio", async () => {
  const source = await Deno.readTextFile(
    new URL("../whatsapp-cloud-inbound-processor/index.ts", import.meta.url),
  );
  const vehicleGate = source.indexOf(
    "ownerMediaRoute === \"veiculo\" &&\n        incomingPhotos.length > 0 &&\n        !contexto",
  );
  assertEquals(vehicleGate >= 0, true);
  assertEquals(source.includes("ownerPhotoRoutingCaption"), true);
  assertEquals(source.includes("liberatedVehiclePhoto"), true);
});
