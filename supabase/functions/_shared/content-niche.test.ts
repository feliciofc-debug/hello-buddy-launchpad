import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveNichoDoConteudo } from "./content-niche.ts";

Deno.test("matriz única de decisão separa produto e veículo", () => {
  assertEquals(resolveNichoDoConteudo("varejo", "produto"), "produto");
  assertEquals(
    resolveNichoDoConteudo("automotivo", "veiculo"),
    "veiculo",
  );
  assertEquals(resolveNichoDoConteudo("amz", "produto"), "produto");
  assertEquals(resolveNichoDoConteudo("amz", "veiculo"), "veiculo");
  assertEquals(resolveNichoDoConteudo("consorcio", "veiculo"), "produto");
});
