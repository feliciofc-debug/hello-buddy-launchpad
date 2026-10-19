import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  gestaoTrocaIaAlertaKm,
  gestaoTrocaIaAvisoCarroceria,
  gestaoTrocaIaBuildItemRows,
  gestaoTrocaIaCategoriaFromAreaTipo,
  gestaoTrocaIaFiltrarItensVision,
  gestaoTrocaIaIsLuzInformativa,
  gestaoTrocaIaResolveFotoPath,
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

Deno.test("luz informativa — cinto e freio de estacionamento ignorados", () => {
  assertEquals(gestaoTrocaIaIsLuzInformativa("Luz do cinto de segurança acesa"), true);
  assertEquals(gestaoTrocaIaIsLuzInformativa("Freio de estacionamento acionado"), true);
  const filtrado = gestaoTrocaIaFiltrarItensVision([
    {
      area: "painel",
      tipo: "luz_alerta",
      gravidade: "leve",
      confianca: "alta",
      descricao: "Indicador de cinto de segurança",
    },
    {
      area: "porta_dianteira_esq",
      tipo: "risco",
      gravidade: "leve",
      confianca: "alta",
      descricao: "Risco leve.",
    },
  ]);
  assertEquals(filtrado.length, 1);
  assertEquals(filtrado[0].tipo, "risco");
});

Deno.test("luz injeção — item sem valor e fora do total", () => {
  const { rows, totalPreparacao } = gestaoTrocaIaBuildItemRows({
    analiseId: "a1",
    userId: "u1",
    trocaId: "t1",
    tabela: GESTAO_TROCA_IA_CUSTOS_PADRAO,
    fotos: [{ path: "u/t/painel.jpg", etiqueta: "Painel ligado (km)" }],
    itens: gestaoTrocaIaFiltrarItensVision([{
      area: "painel",
      tipo: "luz_alerta",
      gravidade: "leve",
      confianca: "alta",
      descricao: "Luz de injeção / check engine acesa",
      foto_indice: 1,
    }]),
  });
  assertEquals(rows.length, 1);
  assertEquals(rows[0].valor_estimado, null);
  assertEquals(totalPreparacao, 0);
  assertEquals(rows[0].foto_path, "u/t/painel.jpg");
});

Deno.test("valor — luz_alerta nunca usa tabela (tipo explícito)", () => {
  const v = gestaoTrocaIaValorEstimadoItem({
    confianca: "alta",
    categoria: "interior",
    gravidade: "leve",
    tabela: GESTAO_TROCA_IA_CUSTOS_PADRAO,
    tipo: "luz_alerta",
  });
  assertEquals(v, null);
});

Deno.test("foto_indice mapeia para path", () => {
  const path = gestaoTrocaIaResolveFotoPath(
    [
      { path: "a.jpg", etiqueta: "Frente" },
      { path: "b.jpg", etiqueta: "Lateral direita" },
    ],
    {
      area: "porta_dianteira_dir",
      tipo: "risco",
      gravidade: "leve",
      confianca: "media",
      descricao: "Risco",
      foto_indice: 2,
    },
  );
  assertEquals(path, "b.jpg");
});
