import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  parseVehiclePhotoActionId,
  vehiclePhotoActionId,
  vehiclePhotoAppearsMessage,
  vehiclePhotoDirectActionList,
} from "./vehicle-photo-direct-menu.ts";
import { parseVehicleIdentification } from "./vehicle-identification.ts";

Deno.test("menu direto — mensagem curta sem Confirma", () => {
  const id = parseVehicleIdentification(JSON.stringify({
    marca: "Chevrolet",
    modelo: "Spin",
    cor: "prata",
    confianca: "alta",
    pistas_visuais: [],
  }));
  assertEquals(
    vehiclePhotoAppearsMessage(id),
    "Pela foto parece um Chevrolet Spin prata.",
  );
});

Deno.test("menu direto — lista com ações esperadas", () => {
  const list = vehiclePhotoDirectActionList();
  assertEquals(list.button, "Ver opções");
  const titles = list.rows.map((row) => row.title);
  assertEquals(titles.includes("Criar arte de anúncio"), true);
  assertEquals(titles.includes("Postar nas redes"), true);
  assertEquals(titles.includes("Corrigir modelo"), true);
  assertEquals(
    parseVehiclePhotoActionId(
      `<<INTERACTIVE_ID:${vehiclePhotoActionId("fipe")}>>`,
    ),
    "fipe",
  );
});
