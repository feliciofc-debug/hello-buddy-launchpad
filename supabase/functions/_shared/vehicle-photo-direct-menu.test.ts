import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  parseVehiclePhotoActionId,
  vehiclePhotoActionId,
  vehiclePhotoAppearsMessage,
  vehiclePhotoDirectActionList,
  vehiclePhotoDirectMenuBody,
  VEHICLE_PHOTO_LIST_BODY_LIMIT,
} from "./vehicle-photo-direct-menu.ts";
import { parseVehicleIdentification } from "./vehicle-identification.ts";

Deno.test("menu direto — linha de identificação com cor e detalhes visíveis", () => {
  const id = parseVehicleIdentification(JSON.stringify({
    marca: "Ford",
    modelo: "Fiesta",
    cor: "prata",
    carroceria: "hatch",
    confianca: "alta",
    pistas_visuais: ["4 portas", "rodas de liga"],
  }));
  assertEquals(
    vehiclePhotoAppearsMessage(id),
    "Pela foto parece um Ford Fiesta, prata, hatch, 4 portas.",
  );
});

Deno.test("FIX-VEIC-2.1 — corpo da lista traz identificação + instrução", () => {
  const id = parseVehicleIdentification(JSON.stringify({
    marca: "Ford",
    modelo: "Fiesta",
    cor: "prata",
    carroceria: "hatch",
    confianca: "alta",
    pistas_visuais: ["4 portas"],
  }));
  const body = vehiclePhotoDirectMenuBody({ identification: id });
  assert(body.includes("Pela foto parece um"));
  assert(body.includes("Ford"));
  assert(body.includes("Fiesta"));
  assert(body.includes("Escolha o que fazer com este veículo."));
  assertEquals(
    vehiclePhotoDirectActionList(id).body,
    body,
  );
});

Deno.test("FIX-VEIC-2.1 — foto repetida no corpo da lista", () => {
  const id = parseVehicleIdentification(JSON.stringify({
    marca: "Chevrolet",
    modelo: "Spin",
    cor: "prata",
    confianca: "alta",
    pistas_visuais: [],
  }));
  const body = vehiclePhotoDirectMenuBody({
    identification: id,
    repeated: true,
  });
  assert(body.includes("Essa foto você já tinha me mandado."));
  assert(body.includes("Pela foto parece um"));
  assert(body.includes("Escolha o que fazer com este veículo."));
});

Deno.test("FIX-VEIC-3-A — menu direto só FIPE, Meta e Vistoria/Troca", () => {
  const id = parseVehicleIdentification(JSON.stringify({
    marca: "Chevrolet",
    modelo: "Spin",
    cor: "prata",
    confianca: "alta",
    pistas_visuais: [],
  }));
  const list = vehiclePhotoDirectActionList(id);
  assertEquals(list.button, "Ver opções");
  const titles = list.rows.map((row) => row.title);
  assertEquals(titles, [
    "Consultar FIPE",
    "Anúncio pago (Meta)",
    "Vistoria / Troca",
  ]);
  assertEquals(
    parseVehiclePhotoActionId(
      `<<INTERACTIVE_ID:${vehiclePhotoActionId("fipe")}>>`,
    ),
    "fipe",
  );
  assert(list.body.length <= VEHICLE_PHOTO_LIST_BODY_LIMIT);
});
