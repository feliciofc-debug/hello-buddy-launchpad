import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  DEFAULT_COMISSAO_REGRA,
  detectComissaoRegraModo,
  normalizeComissaoRegra,
} from "./gestao-comissao-calc.ts";

Deno.test("detecta regra antiga por faixas", () => {
  const modo = detectComissaoRegraModo(normalizeComissaoRegra({
    pctSobreVenda: null,
    pctSobreLucro: 1,
    usarFaixasMargem: true,
  }));
  assertEquals(modo, "faixas");
});

Deno.test("padrão novo é pct venda", () => {
  assertEquals(detectComissaoRegraModo(DEFAULT_COMISSAO_REGRA), "pct_venda");
});
