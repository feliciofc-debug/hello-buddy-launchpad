import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  categoriaCompativelComExtrato,
  suggestCategoriaFromExtrato,
} from "./gestao-conciliacao-categoria.ts";
import { matchExtratoComCandidatos } from "./gestao-conciliacao-match.ts";
import { candidatosFromVendas } from "./gestao-conciliacao-candidates.ts";

Deno.test("suggestCategoriaFromExtrato tarifa bancária", () => {
  assertEquals(suggestCategoriaFromExtrato("TARIFA PACOTE DE SERVICOS", "pagar"), "tarifas_bancarias");
});

Deno.test("suggestCategoriaFromExtrato padrão outros (não aluguel)", () => {
  assertEquals(suggestCategoriaFromExtrato("PIX DESCONHECIDO XYZ", "pagar"), "outros");
  assertEquals(suggestCategoriaFromExtrato("CREDITO GENÉRICO", "receber"), "outros_recebimento");
});

Deno.test("categoriaCompativelComExtrato tarifas_bancarias hints", () => {
  assertEquals(categoriaCompativelComExtrato("IOF OPERACAO", "tarifas_bancarias"), true);
});

Deno.test("match venda por marca/modelo na descrição do banco", () => {
  const vendas = candidatosFromVendas([
    {
      veiculo_id: "v1",
      data_venda: "2026-04-10",
      valor_venda: 250000,
      marca: "Land Rover",
      modelo: "Defender",
    },
  ]);
  const sug = matchExtratoComCandidatos(
    {
      id: "e1",
      data: "2026-04-10",
      descricao: "VENDA LAND ROVER DEFENDER",
      valor: 250000,
      sentido: "credito",
    },
    vendas,
  );
  assertEquals(sug.length, 1);
  assertEquals(sug[0].candidato.tipo, "veiculo_venda");
});
