import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { vehicleMatchesMlItem } from "./ml-duplicate-check.ts";

Deno.test("vehicleMatchesMlItem — marca modelo ano km e preço na tolerância", () => {
  const ok = vehicleMatchesMlItem(
    {
      marca: "Toyota",
      modelo: "Corolla",
      ano_modelo: 2020,
      ano_fabricacao: 2019,
      km: 50000,
      preco: 100000,
    },
    {
      title: "Toyota Corolla 2020 XEI",
      price: 105000,
      attributes: [{ id: "KILOMETERS", value_name: "52000 km" }],
    },
  );
  assertEquals(ok, true);
});

Deno.test("vehicleMatchesMlItem — preço fora de 10% rejeita", () => {
  const ok = vehicleMatchesMlItem(
    { marca: "Toyota", modelo: "Corolla", ano_modelo: 2020, ano_fabricacao: 2019, km: 50000, preco: 100000 },
    { title: "Toyota Corolla 2020", price: 130000, attributes: [] },
  );
  assertEquals(ok, false);
});
