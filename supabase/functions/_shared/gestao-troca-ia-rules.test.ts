import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  gestaoTrocaIaAlertaKm,
  gestaoTrocaIaAvisoCarroceria,
  gestaoTrocaIaCategoriaFromAreaTipo,
  gestaoTrocaIaValorEstimadoItem,
} from "./gestao-troca-ia-rules.ts";
import { GESTAO_TROCA_IA_CUSTOS_PADRAO } from "./gestao-troca-ia-custos.ts";

Deno.test("categoria — área e tipo", () => {
  assertEquals(
    gestaoTrocaIaCategoriaFromAreaTipo("farol_esq", "quebra"),
    "farol_lanterna",
  );
  assertEquals(
    gestaoTrocaIaCategoriaFromAreaTipo("para_choque_dianteiro", "amassado"),
    "para_choque",
  );
  assertEquals(gestaoTrocaIaCategoriaFromAreaTipo("pneu", "desgaste"), "pneu");
  assertEquals(gestaoTrocaIaCategoriaFromAreaTipo("capo", "risco"), "risco");
});

Deno.test("valor — confiança baixa retorna null", () => {
  const v = gestaoTrocaIaValorEstimadoItem({
    confianca: "baixa",
    categoria: "amassado",
    gravidade: "leve",
    tabela: GESTAO_TROCA_IA_CUSTOS_PADRAO,
  });
  assertEquals(v, null);
});

Deno.test("valor — tabela padrão amassado leve", () => {
  const v = gestaoTrocaIaValorEstimadoItem({
    confianca: "alta",
    categoria: "amassado",
    gravidade: "leve",
    tabela: GESTAO_TROCA_IA_CUSTOS_PADRAO,
  });
  assertEquals(v, 500);
});

Deno.test("alerta KM — divergência 4% vs 6%", () => {
  assertEquals(gestaoTrocaIaAlertaKm(100_000, 96_000), false);
  assertEquals(gestaoTrocaIaAlertaKm(100_000, 94_000), true);
});

Deno.test("aviso carroceria — faltam laterais", () => {
  assertEquals(
    gestaoTrocaIaAvisoCarroceria(false, ["Frente", "Traseira"]),
    true,
  );
});
