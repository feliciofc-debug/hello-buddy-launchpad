import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseGestaoMoneyBr } from "./gestao-money-parse.ts";
import {
  gestaoTrocaMergeFipePreservandoKbb,
  gestaoTrocaPatchSomenteFipe,
  gestaoTrocaSnapshotPreservedPricing,
} from "./gestao-troca-ficha-money.ts";

Deno.test("parse digitando milhar e centavos", () => {
  assertEquals(parseGestaoMoneyBr("123.782"), 123_782);
  assertEquals(parseGestaoMoneyBr("45.000,50"), 45_000.5);
});

Deno.test("buscar FIPE — patch só FIPE", () => {
  const patch = gestaoTrocaPatchSomenteFipe(88_000, "out/2026");
  assertEquals(Object.keys(patch).sort(), ["fipe_mes_ref", "fipe_valor"]);
  assertEquals("kbb_troca" in patch, false);
});

Deno.test("buscar FIPE — KBB intacta no merge", () => {
  const preserved = gestaoTrocaSnapshotPreservedPricing({
    kbb_troca: 1,
    kbb_loja: 2,
    kbb_km_caracteristico: 30_000,
    preparacao_estimada: 500,
    valor_proposto: 40_000,
    texts: {
      kbbTroca: "123.782",
      kbbLoja: "130.000",
      preparacao: "1.500",
      valorProposto: "45.000,50",
    },
  });
  assertEquals(preserved.kbb_troca, 123_782);
  assertEquals(preserved.valor_proposto, 45_000.5);

  const merged = gestaoTrocaMergeFipePreservandoKbb(
    {
      ...preserved,
      id: "t1",
      marca: "BMW",
      fipe_valor: 0,
      fipe_mes_ref: "",
    },
    90_000,
    "out/2026",
    preserved,
  );
  assertEquals(merged.kbb_troca, 123_782);
  assertEquals(merged.fipe_valor, 90_000);
  assertEquals(merged.kbb_loja, 130_000);
});
