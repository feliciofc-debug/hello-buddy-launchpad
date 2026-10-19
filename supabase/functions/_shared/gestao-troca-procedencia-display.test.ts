import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildGestaoTrocaProcedenciaLaudo,
  gestaoTrocaProcedenciaDivergenciaFicha,
} from "./gestao-troca-procedencia-display.ts";

Deno.test("procedência laudo sem consulta_id", () => {
  assertEquals(buildGestaoTrocaProcedenciaLaudo({ consultaId: null }), null);
});

Deno.test("divergência marca/modelo ficha × procedência", () => {
  const msg = gestaoTrocaProcedenciaDivergenciaFicha(
    { marca: "Fiat", modelo: "Argo" },
    {
      leilao: { possui: false, classificacao: null, parecer: null },
      perda_total: { possui: false, registro: null },
      roubo_furto: { possui: false, qtd: 0, ultima_data: null, uf: null },
      gravame: { possui: false, situacao: null, agente_financeiro_nome: null },
      renajud: { possui: false, tipos_restricao: [] },
      veiculo: {
        marca: "Volkswagen",
        modelo: "Polo",
        ano_fabricacao: 2022,
        ano_modelo: 2023,
        cor: "Prata",
      },
      saldo_apos: null,
    },
  );
  assertEquals(msg != null, true);
});

Deno.test("placa teste AAA0000", () => {
  const laudo = buildGestaoTrocaProcedenciaLaudo({
    consultaId: "c1",
    consulta: {
      placa: "AAA0000",
      status: "concluida",
      resumo_json: {
        leilao: { possui: false },
        perda_total: { possui: false },
        roubo_furto: { possui: false, qtd: 0 },
        gravame: { possui: false },
        renajud: { possui: false, tipos_restricao: [] },
        veiculo: { marca: "X", modelo: "Y" },
      },
      created_at: "2026-10-19T12:00:00Z",
      concluida_em: "2026-10-19T12:01:00Z",
    },
  });
  assertEquals(laudo?.placaTeste, true);
});
