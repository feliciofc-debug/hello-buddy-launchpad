import type { ProcedenciaResumoJson } from "./consultar-placa-parse.ts";
import type { GestaoTrocaResumoAreaRow } from "./gestao-troca-ia-por-foto-types.ts";
import {
  gestaoTrocaIndicioColisaoMaxNivel,
  type GestaoTrocaIndicioColisaoResult,
} from "./gestao-troca-indicio-colisao.ts";
import type { GestaoTrocaFotoSlotId } from "./gestao-troca-roteiro.ts";

export type GestaoTrocaResultadoLaudo = "aprovado" | "aprovado_com_apontamentos" | "reprovado";

export type GestaoTrocaResultadoLaudoView = {
  resultado: GestaoTrocaResultadoLaudo;
  rotulo: string;
  motivos: string[];
};

const ESTRUTURAL_TIPOS = new Set([
  "solda_aparente",
  "massa_suspeita",
  "parafuso_mexido",
  "fresta_desalinhada",
  "selante_fora_padrao",
]);

function procedenciaBloqueia(resumo: ProcedenciaResumoJson | null): boolean {
  if (!resumo) return false;
  return resumo.leilao.possui || resumo.perda_total.possui || resumo.roubo_furto.possui;
}

export function calcResultadoLaudo(input: {
  roteiro_faltando: GestaoTrocaFotoSlotId[];
  resumo_por_area: GestaoTrocaResumoAreaRow[];
  indicio_colisao: GestaoTrocaIndicioColisaoResult;
  procedencia_resumo: ProcedenciaResumoJson | null;
  itens_confirmados_estruturais: boolean;
  tem_confirmado_moderado_ou_grave: boolean;
  mensagem_parcial?: string | null;
}): GestaoTrocaResultadoLaudoView {
  const motivos: string[] = [];
  if (procedenciaBloqueia(input.procedencia_resumo)) {
    motivos.push("Procedência com leilão, perda total ou roubo/furto");
    return { resultado: "reprovado", rotulo: "🔴 REPROVADO (cautelar)", motivos };
  }
  const indicioMax = gestaoTrocaIndicioColisaoMaxNivel(input.indicio_colisao);
  if (indicioMax === "forte" && input.itens_confirmados_estruturais) {
    motivos.push("Indício forte de colisão com achado estrutural confirmado pelo avaliador");
    return { resultado: "reprovado", rotulo: "🔴 REPROVADO (cautelar)", motivos };
  }

  const graveArea = input.resumo_por_area.some((a) => a.condicao === "grave");
  const atencaoArea = input.resumo_por_area.some((a) => a.condicao === "atencao");
  const leveArea = input.resumo_por_area.some((a) => a.condicao === "leve");
  const roteiroIncompleto = input.roteiro_faltando.length > 0;

  const limpoParaVerde = !graveArea &&
    !atencaoArea &&
    !leveArea &&
    !input.tem_confirmado_moderado_ou_grave &&
    indicioMax === "nenhum";

  if (input.roteiro_faltando.length === 0 && limpoParaVerde) {
    return {
      resultado: "aprovado",
      rotulo: "🟢 APROVADO (cautelar)",
      motivos: ["Roteiro completo, sem apontamentos relevantes nem indício de colisão."],
    };
  }

  if (roteiroIncompleto && input.mensagem_parcial) motivos.push(input.mensagem_parcial);
  if (roteiroIncompleto) motivos.push("Roteiro de fotos incompleto");
  if (graveArea) motivos.push("Área com apontamento grave no laudo");
  if (atencaoArea) motivos.push("Área com apontamento que exige atenção");
  if (leveArea) motivos.push("Área com apontamentos leves");
  if (input.tem_confirmado_moderado_ou_grave) {
    motivos.push("Item moderado ou grave confirmado pelo avaliador");
  }
  if (indicioMax === "fraco" || indicioMax === "moderado") {
    motivos.push(`Indício visual de colisão: ${indicioMax}`);
  }
  if (indicioMax === "forte" && !input.itens_confirmados_estruturais) {
    motivos.push("Indício forte — aguardando confirmação em vistoria cautelar");
  }

  return {
    resultado: "aprovado_com_apontamentos",
    rotulo: "🟡 APROVADO COM APONTAMENTOS (cautelar)",
    motivos: motivos.length ? motivos : ["Laudo com ressalvas."],
  };
}
