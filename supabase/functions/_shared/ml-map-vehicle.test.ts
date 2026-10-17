import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapVehicleToMlItem } from "./ml-map-vehicle.ts";
import type { MlCategoryAttribute, VeiculoEstoqueRow } from "./ml-vehicle-types.ts";

const baseVehicle: VeiculoEstoqueRow = {
  id: "v1",
  user_id: "u1",
  marca: "BMW",
  modelo: "X6",
  versao: "2024",
  ano_fabricacao: 2024,
  ano_modelo: 2024,
  km: 10000,
  preco: 500000,
  combustivel: "Gasolina",
  cambio: "Automático",
  portas: 4,
  cor: "Preto",
  descricao: "Ok",
  fotos: ["https://example.com/1.jpg"],
  status: "disponivel",
};

const attrs: MlCategoryAttribute[] = [
  { id: "BRAND", name: "Marca", tags: { required: true }, values: [{ id: "1", name: "BMW" }] },
  { id: "MODEL", name: "Modelo", tags: { required: true }, values: [{ id: "2", name: "X6" }] },
];

Deno.test("mapVehicleToMlItem bloqueia sem localização ML", () => {
  const r = mapVehicleToMlItem({
    vehicle: baseVehicle,
    categoryId: "MLB1744",
    categoryAttributes: attrs,
    mlLocationJson: null,
    sellerContact: { phone2: "21999999999", country_code2: "55" },
  });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.blocking.some((b) => b.field === "localizacao"), true);
});

Deno.test("mapVehicleToMlItem ok com localização e attrs", () => {
  const r = mapVehicleToMlItem({
    vehicle: baseVehicle,
    categoryId: "MLB1744",
    categoryAttributes: attrs,
    mlLocationJson: {
      source: "tenant_override",
      updated_at: "2026-01-01",
      location: {
        city: { id: "BR-SP-1", name: "São Paulo" },
        state: { id: "BR-SP", name: "SP" },
        country: { id: "BR" },
      },
    },
    sellerContact: { phone2: "21999999999", country_code2: "55" },
  });
  assertEquals(r.ok, true);
});
