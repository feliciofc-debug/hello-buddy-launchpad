import { formatYmdSaoPaulo } from "./gestao-date-br.ts";
import { competenciaFromDate } from "./gestao-meta-calc.ts";

export type GestaoRecorrenciaSerie = {
  id: string;
  tipo: "pagar" | "receber";
  categoria_operacional: string;
  valor: number;
  dia_mes: number;
  forma_pagamento: string | null;
  observacao: string | null;
  veiculo_id: string | null;
  encerrada_a_partir_de: string | null;
};

export type GestaoRecorrenciaLancamento = {
  serie_id: string;
  competencia: string;
  id?: string;
  pago_em: string | null;
  recebido_em: string | null;
};

export function vencimentoFromCompetenciaDia(competencia: string, diaMes: number): string {
  const [y, m] = competencia.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const day = Math.min(diaMes, last);
  return `${competencia}-${String(day).padStart(2, "0")}`;
}

export function competenciasGeracao(now = new Date()): string[] {
  const cur = competenciaFromDate(now);
  const next = competenciaFromDate(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  return [cur, next];
}

export function serieAtivaNaCompetencia(serie: GestaoRecorrenciaSerie, competencia: string): boolean {
  if (!serie.encerrada_a_partir_de) return true;
  return competencia < serie.encerrada_a_partir_de;
}

export function planRecorrenciaLancamentos(
  series: GestaoRecorrenciaSerie[],
  existing: GestaoRecorrenciaLancamento[],
  now = new Date(),
): Array<{
  serie_id: string;
  competencia: string;
  vencimento: string;
  tipo: "pagar" | "receber";
  categoria_operacional: string;
  valor: number;
  forma_pagamento: string | null;
  observacao: string | null;
  veiculo_id: string | null;
}> {
  const have = new Set(existing.map((e) => `${e.serie_id}:${e.competencia}`));
  const out: ReturnType<typeof planRecorrenciaLancamentos> = [];

  for (const s of series) {
    for (const comp of competenciasGeracao(now)) {
      if (!serieAtivaNaCompetencia(s, comp)) continue;
      const key = `${s.id}:${comp}`;
      if (have.has(key)) continue;
      out.push({
        serie_id: s.id,
        competencia: comp,
        vencimento: vencimentoFromCompetenciaDia(comp, s.dia_mes),
        tipo: s.tipo,
        categoria_operacional: s.categoria_operacional,
        valor: s.valor,
        forma_pagamento: s.forma_pagamento,
        observacao: s.observacao,
        veiculo_id: s.veiculo_id,
      });
    }
  }
  return out;
}

/** Atualiza lançamentos futuros não liquidados quando a série muda. */
export function planAtualizacaoLancamentosFuturos(
  serie: GestaoRecorrenciaSerie,
  lancamentos: GestaoRecorrenciaLancamento[],
  fromCompetencia: string,
): Array<{ id: string; valor: number; vencimento: string; observacao: string | null }> {
  return lancamentos
    .filter((l) => l.serie_id === serie.id && l.competencia >= fromCompetencia)
    .filter((l) => !(l.pago_em || l.recebido_em))
    .map((l) => ({
      id: l.id!,
      valor: serie.valor,
      vencimento: vencimentoFromCompetenciaDia(l.competencia, serie.dia_mes),
      observacao: serie.observacao,
    }));
}

export type GestaoSerieProjecao = {
  id: string;
  tipo: "pagar" | "receber";
  valor: number;
  dia_mes: number;
  encerrada_a_partir_de: string | null;
};

/** Virtual só além do fim do próximo mês civil. */
export function projectSeriesAposProximoMes(
  series: GestaoSerieProjecao[],
  existingKeys: Set<string>,
  now = new Date(),
  untilIso: string,
): Array<{ id: string; tipo: "pagar" | "receber"; valor: number; vencimento: string }> {
  const out: Array<{ id: string; tipo: "pagar" | "receber"; valor: number; vencimento: string }> = [];
  const proximoFim = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const startAfter = formatYmdSaoPaulo(proximoFim);

  for (const s of series) {
    let cursor = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    const until = new Date(untilIso);
    while (cursor <= until) {
      const comp = competenciaFromDate(cursor);
      if (!serieAtivaNaCompetencia(s as GestaoRecorrenciaSerie, comp)) break;
      const venc = vencimentoFromCompetenciaDia(comp, s.dia_mes);
      if (venc > startAfter) {
        const key = `${s.id}:${comp}`;
        if (!existingKeys.has(key)) {
          out.push({
            id: `virt-${s.id}-${comp}`,
            tipo: s.tipo,
            valor: s.valor,
            vencimento: venc,
          });
        }
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }
  return out;
}
