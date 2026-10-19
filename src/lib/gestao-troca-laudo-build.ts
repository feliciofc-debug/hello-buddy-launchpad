import type { GestaoTrocaRow } from "@/lib/gestao-troca-types.ts";
import { buildGestaoTrocaLaudoPdfSection } from "@/lib/gestao-troca-laudo-pdf-section.ts";
import type { GestaoTrocaLaudoPdfSection } from "@/lib/gestao-troca-laudo-pdf-section.ts";
import {
  buildGestaoTrocaLaudoDescricaoPdf,
  type GestaoTrocaLaudoDescricaoPdf,
} from "@/lib/gestao-troca-ia-descricao-display.ts";
import type { GestaoTrocaIaAnalise, GestaoTrocaIaItem } from "@/lib/gestao-troca-ia-types.ts";

export function buildGestaoTrocaLaudoPdfFromAnalise(
  troca: Pick<GestaoTrocaRow, "km" | "km_painel_conferido">,
  analise: GestaoTrocaIaAnalise | null,
  itens: GestaoTrocaIaItem[],
): GestaoTrocaLaudoPdfSection | null {
  if (!analise) return null;
  const confirmados = itens
    .filter((i) => i.decisao === "confirmado")
    .map((i) => ({
      area: i.area,
      tipo: i.tipo,
      descricao: i.descricao,
      valor: i.valor_estimado,
    }));
  return buildGestaoTrocaLaudoPdfSection({
    analiseStatus: analise.status,
    km_painel_lido: analise.km_painel_lido,
    km_ficha: analise.km_ficha,
    km_informado: troca.km,
    alerta_km: analise.alerta_km,
    km_painel_conferido: troca.km_painel_conferido === true,
    luzes_painel: analise.luzes_painel,
    aviso_carroceria: analise.aviso_carroceria,
    qualidade_json: analise.qualidade_json,
    resumo: analise.resumo,
    modelo_ia: analise.modelo_ia ?? null,
    concluida_em: analise.concluida_em,
    itensConfirmados: confirmados,
  });
}

export function buildGestaoTrocaLaudoDescricaoFromAnalise(
  analise: GestaoTrocaIaAnalise | null,
): GestaoTrocaLaudoDescricaoPdf | null {
  if (!analise) return null;
  return buildGestaoTrocaLaudoDescricaoPdf(
    analise.descricao_areas_json,
    analise.conclusao_visual ?? null,
  );
}
