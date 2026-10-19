import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  gestaoTrocaIaAlertaKm,
  gestaoTrocaIaAvisoCarroceria,
  gestaoTrocaIaCategoriaFromAreaTipo,
  gestaoTrocaIaValorEstimadoItem,
} from "./gestao-troca-ia-rules.ts";
import { GESTAO_TROCA_IA_CUSTOS_PADRAO } from "./gestao-troca-ia-custos.ts";

Deno.test("categoria — lataria -> funilaria_pintura", () => {
  assertEquals(gestaoTrocaIaCategoriaFromAreaTipo("lataria", "amassado"), "funilaria_pintura");
  assertEquals(gestaoTrocaIaCategoriaFromAreaTipo("motor", "vazamento"), "mecanica");
  assertEquals(gestaoTrocaIaCategoriaFromAreaTipo("pneus", "desgaste"), "pneus");
});

Deno.test("valor — confiança baixa retorna null", () => {
  const v = gestaoTrocaIaValorEstimadoItem({
    confianca: "baixa",
    categoria: "mecanica",
    gravidade: "leve",
    tabela: GESTAO_TROCA_IA_CUSTOS_PADRAO,
  });
  assertEquals(v, null);
});

Deno.test("valor — tabela padrão mecanica leve", () => {
  const v = gestaoTrocaIaValorEstimadoItem({
    confianca: "alta",
    categoria: "mecanica",
    gravidade: "leve",
    tabela: GESTAO_TROCA_IA_CUSTOS_PADRAO,
  });
  assertEquals(v, 250);
});

Deno.test("alerta KM — divergência >5%", () => {
  assertEquals(gestaoTrocaIaAlertaKm(100_000, 96_000), false);
  assertEquals(gestaoTrocaIaAlertaKm(100_000, 94_000), true);
  assertEquals(gestaoTrocaIaAlertaKm(null, 50_000), false);
});

Deno.test("aviso carroceria — faltam laterais", () => {
  assertEquals(
    gestaoTrocaIaAvisoCarroceria(false, ["Frente", "Traseira"]),
    true,
  );
  assertEquals(
    gestaoTrocaIaAvisoCarroceria(
      false,
      ["Frente", "Traseira", "Lateral esquerda", "Lateral direita"],
    ),
    false,
  );
});
