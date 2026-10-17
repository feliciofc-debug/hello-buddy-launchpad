import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  lucroLiquidoAntesComissaoAuto,
  margemPctAntesComissaoAuto,
} from "./gestao-lucro-comissao-base.ts";
import { calcGestaoComissao, DEFAULT_COMISSAO_REGRA } from "./gestao-comissao-calc.ts";

Deno.test("lucro base exclui comissão automática", () => {
  const lucro = lucroLiquidoAntesComissaoAuto({
    valorCompra: 250_000,
    valorVenda: 300_000,
    despesas: [
      { valor: 5_000, categoria: "mecanica", origem_lancamento: "painel" },
      { valor: 1_500, categoria: "comissao", origem_lancamento: "automatica" },
    ],
  });
  assertEquals(lucro, 45_000);
});

Deno.test("recalcular comissão 3x mantém o mesmo valor (sem base circular)", () => {
  const valorVenda = 300_000;
  const lucroBase = 45_000;
  const margem = margemPctAntesComissaoAuto(lucroBase, valorVenda)!;
  const vals = [1, 2, 3].map(() =>
    calcGestaoComissao({
      valorVenda,
      lucroLiquido: lucroBase,
      margemPct: margem,
      regra: DEFAULT_COMISSAO_REGRA,
    }).total
  );
  assertEquals(vals[0], vals[1]);
  assertEquals(vals[1], vals[2]);
  assertEquals(vals[0], 675);
});
