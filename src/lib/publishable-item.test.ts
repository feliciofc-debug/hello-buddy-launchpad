// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

/** Espelha vehicleAsPublishableItem — custos internos não entram em anúncios. */
function vehicleAsPublishableItem(vehicle: Record<string, unknown>) {
  return {
    id: vehicle.id,
    item_tipo: "veiculo",
    veiculo: {
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      preco: vehicle.preco,
    },
    nome: `${vehicle.marca} ${vehicle.modelo}`,
    descricao: vehicle.descricao,
    preco: vehicle.preco,
  };
}

Deno.test("publishable item não inclui valor_compra nem despesas", () => {
  const item = vehicleAsPublishableItem({
    id: "v1",
    marca: "BMW",
    modelo: "X6",
    preco: 520000,
    descricao: "Completo",
    valor_compra: 400000,
    despesas_internas: [{ valor: 5000 }],
  });
  const json = JSON.stringify(item);
  assertEquals(json.includes("valor_compra"), false);
  assertEquals(json.includes("400000"), false);
  assertEquals(json.includes("despesas"), false);
  assertEquals(item.preco, 520000);
});
