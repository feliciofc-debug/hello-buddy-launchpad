import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { matchGestaoVendedor, vendedorHintFromText } from "./gestao-vendedor-match.ts";

const team = [
  { id: "1", nome: "João Silva", ativo: true },
  { id: "2", nome: "Maria", ativo: true },
];

Deno.test("extrai hint vendedor do texto", () => {
  assertEquals(
    vendedorHintFromText("vendi o X6 por 520 mil, vendedor João"),
    "João",
  );
});

Deno.test("match vendedor por nome parcial", () => {
  assertEquals(matchGestaoVendedor("João", team)?.id, "1");
});
