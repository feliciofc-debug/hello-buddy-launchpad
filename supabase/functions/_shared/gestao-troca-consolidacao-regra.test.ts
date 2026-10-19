import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calcResumoPorAreaRegra } from "./gestao-troca-consolidacao-regra.ts";

Deno.test("condição por área — grave só em pneus", () => {
  const rows = calcResumoPorAreaRegra({
    fotosNorm: [
      { path: "a", etiqueta: "Outra", slot: "pneu_de" },
      { path: "b", etiqueta: "Outra", slot: "frente" },
    ],
    fotoRows: [
      {
        indice: 1,
        slot_informado: "pneu_de",
        slot_identificado: null,
        qualidade_imagem: "boa",
        motivo_qualidade: "",
        descricao: "pneu",
        achados: [{
          tipo: "pneu_sulco_baixo",
          local: "pneu",
          severidade: "grave",
          confianca: "alta",
          evidencia: "careca",
        }],
        nao_da_para_afirmar: [],
      },
      {
        indice: 2,
        slot_informado: "frente",
        slot_identificado: null,
        qualidade_imagem: "boa",
        motivo_qualidade: "",
        descricao: "ok",
        achados: [],
        nao_da_para_afirmar: [],
      },
    ],
  });
  const pneus = rows.find((r) => r.area === "pneus");
  const externo = rows.find((r) => r.area === "externo");
  assertEquals(pneus?.condicao, "grave");
  assertEquals(externo?.condicao, "sem_apontamento");
});
