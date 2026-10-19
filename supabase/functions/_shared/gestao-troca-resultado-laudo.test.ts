import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calcResultadoLaudo } from "./gestao-troca-resultado-laudo.ts";

const indicioNenhum = {
  dianteira: { nivel: "nenhum" as const, evidencias: [] },
  traseira: { nivel: "nenhum" as const, evidencias: [] },
  lateral_esq: { nivel: "nenhum" as const, evidencias: [] },
  lateral_dir: { nivel: "nenhum" as const, evidencias: [] },
};

Deno.test("resultado cautelar — aprovado roteiro completo", () => {
  const r = calcResultadoLaudo({
    roteiro_faltando: [],
    resumo_por_area: [{ area: "externo", condicao: "sem_apontamento", texto: "ok", fotos: [1] }],
    indicio_colisao: indicioNenhum,
    procedencia_resumo: null,
    itens_confirmados_estruturais: false,
    tem_confirmado_moderado_ou_grave: false,
  });
  assertEquals(r.resultado, "aprovado");
});

Deno.test("resultado cautelar — reprovado procedência", () => {
  const r = calcResultadoLaudo({
    roteiro_faltando: [],
    resumo_por_area: [],
    indicio_colisao: indicioNenhum,
    procedencia_resumo: {
      leilao: { possui: true, classificacao: "C", parecer: "x" },
      perda_total: { possui: false, registro: null },
      roubo_furto: { possui: false, qtd: 0, ultima_data: null, uf: null },
      gravame: { possui: false, situacao: null, agente_financeiro_nome: null },
      renajud: { possui: false, tipos_restricao: [] },
      veiculo: { marca: "F", modelo: "M", ano_fabricacao: 2020, ano_modelo: 2021, cor: null },
      saldo_apos: null,
    },
    itens_confirmados_estruturais: false,
    tem_confirmado_moderado_ou_grave: false,
  });
  assertEquals(r.resultado, "reprovado");
});

Deno.test("resultado cautelar — reprovado indício forte + estrutural confirmado", () => {
  const r = calcResultadoLaudo({
    roteiro_faltando: [],
    resumo_por_area: [],
    indicio_colisao: {
      dianteira: { nivel: "forte", evidencias: [] },
      traseira: { nivel: "nenhum", evidencias: [] },
      lateral_esq: { nivel: "nenhum", evidencias: [] },
      lateral_dir: { nivel: "nenhum", evidencias: [] },
    },
    procedencia_resumo: null,
    itens_confirmados_estruturais: true,
    tem_confirmado_moderado_ou_grave: true,
  });
  assertEquals(r.resultado, "reprovado");
});
