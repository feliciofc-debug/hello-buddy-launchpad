import type { ProcedenciaResumoJson } from "./consultar-placa-parse.ts";
import { normalizeGestaoTrocaFotos, type GestaoTrocaFotoEntry } from "./gestao-troca-fotos.ts";
import type { GestaoTrocaEspessuraFaixas } from "./gestao-troca-espessura.ts";
import type { GestaoTrocaIaFotoAnaliseRow } from "./gestao-troca-ia-foto-schema.ts";
import type { GestaoTrocaResumoAreaRow } from "./gestao-troca-ia-por-foto.ts";
import {
  parseGestaoTrocaAnaliseFotoRows,
  recalcIndicioColisaoGestaoTroca,
} from "./gestao-troca-indicio-recalc.ts";
import type { GestaoTrocaIndicioColisaoResult } from "./gestao-troca-indicio-colisao.ts";
import { calcResultadoLaudo, type GestaoTrocaResultadoLaudoView } from "./gestao-troca-resultado-laudo.ts";
import { gestaoTrocaRoteiroProgress, type GestaoTrocaFotoSlotId } from "./gestao-troca-roteiro.ts";

const ESTRUTURAL_TIPOS = new Set([
  "solda_aparente",
  "massa_suspeita",
  "parafuso_mexido",
  "fresta_desalinhada",
  "selante_fora_padrao",
  "diferenca_tonalidade",
  "sinal_repintura",
]);

export function isGestaoTrocaLaudo19FotosJson(raw: unknown): boolean {
  const rows = parseGestaoTrocaAnaliseFotoRows(raw);
  return rows.length > 0 && rows.some((r) => r.slot_informado != null && r.descricao != null);
}

function resumoFromEstrutura(estrutura: Record<string, unknown> | null | undefined): GestaoTrocaResumoAreaRow[] {
  const raw = estrutura?.resumo_por_area;
  if (!Array.isArray(raw)) return [];
  return raw.filter((r) => r && typeof r === "object") as GestaoTrocaResumoAreaRow[];
}

export function statsItensConfirmadosLaudo(
  itens: { decisao?: string; tipo?: string; gravidade?: string }[],
): { estrutural: boolean; moderadoOuGrave: boolean } {
  const confirmados = itens.filter((i) => String(i.decisao) === "confirmado");
  return {
    estrutural: confirmados.some((i) => ESTRUTURAL_TIPOS.has(String(i.tipo))),
    moderadoOuGrave: confirmados.some((i) => {
      const g = String(i.gravidade);
      return g === "moderada" || g === "grave";
    }),
  };
}

export type GestaoTrocaLaudo19Computed = {
  isLaudo19: boolean;
  fotoRows: GestaoTrocaIaFotoAnaliseRow[];
  resumo_por_area: GestaoTrocaResumoAreaRow[];
  indicio_colisao: GestaoTrocaIndicioColisaoResult;
  resultado: GestaoTrocaResultadoLaudoView;
  roteiro_faltando: GestaoTrocaFotoSlotId[];
  mensagem_parcial: string | null;
};

export function buildGestaoTrocaLaudo19Computed(input: {
  fotos_json: unknown;
  estrutura_json?: Record<string, unknown> | null;
  espessura_json: unknown;
  faixas?: GestaoTrocaEspessuraFaixas;
  itens?: { achado_ref?: string | null; decisao?: string; tipo?: string; gravidade?: string }[];
  fotosNorm?: GestaoTrocaFotoEntry[];
  procedencia_resumo: ProcedenciaResumoJson | null;
}): GestaoTrocaLaudo19Computed | null {
  if (!isGestaoTrocaLaudo19FotosJson(input.fotos_json)) return null;
  const fotoRows = parseGestaoTrocaAnaliseFotoRows(input.fotos_json);
  const fotosNorm = input.fotosNorm ?? normalizeGestaoTrocaFotos([]);
  const roteiro = gestaoTrocaRoteiroProgress(fotosNorm);
  const estrutura = input.estrutura_json ?? null;
  const resumo_por_area = resumoFromEstrutura(estrutura);
  const mensagem_parcial = estrutura?.mensagem_parcial != null
    ? String(estrutura.mensagem_parcial)
    : null;

  const indicio_colisao = recalcIndicioColisaoGestaoTroca({
    fotos_json: fotoRows,
    espessura_json: input.espessura_json,
    faixas: input.faixas,
    itens: input.itens,
  });

  const stats = statsItensConfirmadosLaudo(input.itens ?? []);
  const resultado = calcResultadoLaudo({
    roteiro_faltando: roteiro.faltando,
    resumo_por_area,
    indicio_colisao,
    procedencia_resumo: input.procedencia_resumo,
    itens_confirmados_estruturais: stats.estrutural,
    tem_confirmado_moderado_ou_grave: stats.moderadoOuGrave,
    mensagem_parcial,
  });

  return {
    isLaudo19: true,
    fotoRows,
    resumo_por_area,
    indicio_colisao,
    resultado,
    roteiro_faltando: roteiro.faltando,
    mensagem_parcial,
  };
}
