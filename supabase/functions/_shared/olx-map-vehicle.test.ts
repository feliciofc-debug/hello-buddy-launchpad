import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertOlxAdPayloadSafe, mapVehicleToOlxAd } from "./olx-map-vehicle.ts";
import { olxPublicPhotoUrls } from "./olx-public-text.ts";

const baseVehicle = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: "u1",
  segmento: "carro",
  marca: "VW",
  modelo: "Gol",
  versao: "1.0",
  ano_fabricacao: 2020,
  ano_modelo: 2020,
  km: 40000,
  preco: 55000,
  combustivel: "Flex",
  cambio: "Manual",
  cor: "Prata",
  descricao: "Carro impecável, único dono.",
  fotos: ["https://cdn.example.com/foto.jpg"],
  status: "disponivel",
};

const mlLoc = {
  location: { zip_code: "01310100", city: { id: "c" }, state: { id: "s" } },
};

Deno.test("payload OLX não contém fipe/custo/trocas", () => {
  const mapped = mapVehicleToOlxAd({
    vehicle: baseVehicle,
    mlLocationJson: mlLoc,
    phone: "21999998888",
    adRef: "amz1111111111111111",
    operation: "insert",
  });
  assertEquals(mapped.ok, true);
  if (!mapped.ok) return;
  assertOlxAdPayloadSafe(mapped.ad);
  const json = JSON.stringify(mapped.ad);
  assertEquals(json.includes("fipe"), false);
  assertEquals(json.includes("custo"), false);
});

Deno.test("fotos de trocas são excluídas", () => {
  const urls = olxPublicPhotoUrls([
    "https://x.supabase.co/storage/v1/object/public/estoque/a.jpg",
    "https://x.supabase.co/storage/v1/object/public/trocas/b.jpg",
  ]);
  assertEquals(urls.length, 1);
  assertEquals(urls[0].includes("estoque"), true);
});

Deno.test("veículo vendido bloqueia publicar", () => {
  const mapped = mapVehicleToOlxAd({
    vehicle: { ...baseVehicle, status: "vendido" },
    mlLocationJson: mlLoc,
    phone: "21999998888",
    adRef: "amz1111111111111111",
    operation: "insert",
  });
  assertEquals(mapped.ok, false);
});

Deno.test("delete monta operação mínima", () => {
  const mapped = mapVehicleToOlxAd({
    vehicle: baseVehicle,
    mlLocationJson: null,
    phone: "",
    adRef: "amz1111111111111111",
    operation: "delete",
  });
  assertEquals(mapped.ok, true);
  if (!mapped.ok) return;
  assertEquals(mapped.ad.operation, "delete");
});
