import {
  matchExtratoComCandidatos,
  refKeyCandidato,
  statusFromSugestoes,
  type GestaoConciliacaoCandidato,
} from "../../supabase/functions/_shared/gestao-conciliacao-match.ts";
import type { GestaoExtratoTransacao } from "./gestao-conciliacao-load.ts";

export type ExtratoComSugestoes = GestaoExtratoTransacao & {
  sugestoes: ReturnType<typeof matchExtratoComCandidatos>;
  statusSugerido: ReturnType<typeof statusFromSugestoes>;
};

export function refsOcupadosFromExtratos(extratos: GestaoExtratoTransacao[]): Set<string> {
  const s = new Set<string>();
  for (const e of extratos) {
    if (e.status === "conciliado" && e.match_tipo && e.match_ref_id) {
      s.add(refKeyCandidato({ tipo: e.match_tipo, refId: e.match_ref_id }));
    }
  }
  return s;
}

export function classificarExtrato(
  extratos: GestaoExtratoTransacao[],
  candidatos: GestaoConciliacaoCandidato[],
): ExtratoComSugestoes[] {
  const refsOcupados = refsOcupadosFromExtratos(extratos);

  return extratos.map((e) => {
    if (e.status === "conciliado") {
      return { ...e, sugestoes: [], statusSugerido: "conciliado" as const };
    }
    const sugestoes = matchExtratoComCandidatos(
      { id: e.id, data: e.data, descricao: e.descricao, valor: Number(e.valor), sentido: e.sentido },
      candidatos,
      { refsOcupados },
    );
    const statusSugerido = e.status === "confirmar" ? "confirmar" as const : statusFromSugestoes(sugestoes);
    return { ...e, sugestoes, statusSugerido };
  });
}

export function saldoExtrato(extratos: GestaoExtratoTransacao[]): number {
  return extratos.reduce((acc, e) => {
    const v = Number(e.valor);
    return e.sentido === "credito" ? acc + v : acc - v;
  }, 0);
}
