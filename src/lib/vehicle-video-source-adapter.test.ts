// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  publicVehicleStockPhotos,
  vehicleRowToPublishableItem,
  vehicleVideoDisplayTitle,
  vehicleVideoHighlightBullets,
  vehicleVideoPriceForOverlay,
} from "./vehicle-video-source-adapter.ts";

Deno.test("adapter veículo: só fotos públicas do estoque", () => {
  const photos = publicVehicleStockPhotos({
    fotos: ["https://cdn.example/a.jpg", "  ", "trocas/secret.jpg"],
  });
  assertEquals(photos, ["https://cdn.example/a.jpg"]);
});

Deno.test("adapter veículo: overlay sem placa, FIPE ou custo", () => {
  const item = vehicleRowToPublishableItem({
    id: "v1",
    marca: "BMW",
    modelo: "320i",
    versao: "GP",
    km: 38000,
    cambio: "Automático",
    preco: 189900,
    fotos: ["https://cdn.example/a.jpg"],
    status: "disponivel",
  });
  const json = JSON.stringify(item);
  assertEquals(json.includes("placa"), false);
  assertEquals(json.includes("FIPE"), false);
  assertEquals(json.includes("valor_compra"), false);
  assertEquals(
    vehicleVideoDisplayTitle({
      id: "v1",
      marca: "BMW",
      modelo: "320i",
      versao: "GP",
    }),
    "BMW 320i GP",
  );
  assertEquals(
    vehicleVideoHighlightBullets({
      id: "v1",
      marca: "BMW",
      modelo: "320i",
      km: 38000,
      cambio: "Automático",
    }).length >= 1,
    true,
  );
  assertEquals(vehicleVideoPriceForOverlay({ preco: 189900 }).precoLabel, "R$ 189.900,00");
  assertEquals(vehicleVideoPriceForOverlay({ preco: null }).precoLabel, null);
});
