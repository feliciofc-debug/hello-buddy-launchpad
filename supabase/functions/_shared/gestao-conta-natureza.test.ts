import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { contasToDreOperacionalRows } from "./gestao-contador-data.ts";
import { calcDreMes } from "./gestao-dre-calc.ts";

const migration = await Deno.readTextFile(new URL(
  "../../migrations/20261032262000_gestao_conta_natureza.sql",
  import.meta.url,
));

const base = {
  categoria_operacional: "outros",
  vencimento: "2026-10-10",
  pago_em: null,
};

Deno.test("OS-1.1 — repasse e troco não entram como despesa operacional", () => {
  const rows = contasToDreOperacionalRows([
    { ...base, tipo: "pagar", natureza: "repasse_terceiro", valor: 105_000 },
    { ...base, tipo: "pagar", natureza: "troco_cliente", valor: 10_000 },
    { ...base, tipo: "pagar", natureza: "operacional", valor: 2_000 },
  ]);
  assertEquals(rows.map((r) => r.valor), [2_000]);
});

Deno.test("OS-1.1 — OS conta uma vez no carro e nunca outra vez na DRE operacional", () => {
  const operacionais = contasToDreOperacionalRows([
    { ...base, tipo: "pagar", natureza: "custo_veiculo", valor: 3_000 },
  ]);
  const dre = calcDreMes("2026-10", [{
    veiculoId: "carro-1",
    dataVenda: "2026-10-20",
    valorVenda: 50_000,
    valorCompra: 40_000,
    despesas: [{ categoria: "mecanica", valor: 3_000 }],
  }], operacionais);
  assertEquals(dre.despesasCarros, 3_000);
  assertEquals(dre.despesasOperacionais, 0);
  assertEquals(dre.lucroLiquidoLoja, 7_000);
});

Deno.test("OS-1.1 — lançamento manual operacional continua no DRE", () => {
  const operacionais = contasToDreOperacionalRows([
    { ...base, tipo: "pagar", natureza: "operacional", valor: 1_500 },
  ]);
  assertEquals(calcDreMes("2026-10", [], operacionais).despesasOperacionais, 1_500);
});

Deno.test("OS-1.1 — backfill e escritores automáticos classificam natureza", () => {
  assertStringIncludes(migration, "observacao LIKE 'Repasse consignante%'");
  assertStringIncludes(migration, "observacao LIKE 'Composição venda%' AND tipo = 'pagar'");
  assertStringIncludes(migration, "observacao LIKE 'Composição venda%' AND tipo = 'receber'");
  assertStringIncludes(migration, "origem = 'os_auto'");
  assertStringIncludes(migration, "'repasse_terceiro'");
  assertStringIncludes(migration, "'troco_cliente'");
  assertStringIncludes(migration, "'saldo_cliente'");
  assertStringIncludes(migration, "registrar_venda_com_troca_impl_20261032250000");
});
