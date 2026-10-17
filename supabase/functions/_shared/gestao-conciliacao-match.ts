export const GESTAO_CONCILIACAO_DIAS_TOLERANCIA = 3;

export type GestaoConciliacaoCandidato = {
  tipo: "conta_pagar" | "conta_receber" | "veiculo_despesa" | "veiculo_venda" | "comissao_extrato";
  refId: string;
  data: string;
  valor: number;
  descricao: string;
  liquidado: boolean;
};

export type GestaoExtratoParaMatch = {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  sentido: "debito" | "credito";
};

export type GestaoConciliacaoSugestao = {
  extratoId: string;
  candidato: GestaoConciliacaoCandidato;
  score: number;
  auto: boolean;
};

function daysDiff(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  return Math.abs(Math.floor((da.getTime() - db.getTime()) / 86400000));
}

function descricaoScore(a: string, b: string): number {
  const ta = a.toLowerCase().split(/\W+/).filter((x) => x.length > 2);
  const tb = b.toLowerCase().split(/\W+/).filter((x) => x.length > 2);
  if (!ta.length || !tb.length) return 0;
  let hit = 0;
  for (const w of ta) if (tb.some((x) => x.includes(w) || w.includes(x))) hit += 1;
  return hit / Math.max(ta.length, tb.length);
}

function valorMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

export function matchExtratoComCandidatos(
  extrato: GestaoExtratoParaMatch,
  candidatos: GestaoConciliacaoCandidato[],
  diasTolerancia = GESTAO_CONCILIACAO_DIAS_TOLERANCIA,
): GestaoConciliacaoSugestao[] {
  const pool = candidatos.filter((c) => {
    if (extrato.sentido === "debito") {
      return c.tipo === "conta_pagar" || c.tipo === "veiculo_despesa" || c.tipo === "comissao_extrato";
    }
    return c.tipo === "conta_receber" || c.tipo === "veiculo_venda";
  }).filter((c) => valorMatch(extrato.valor, c.valor))
    .filter((c) => daysDiff(extrato.data, c.data) <= diasTolerancia);

  const scored = pool.map((c) => {
    const dateScore = 1 - Math.min(daysDiff(extrato.data, c.data), diasTolerancia) / (diasTolerancia + 1);
    const descScore = descricaoScore(extrato.descricao, c.descricao);
    const score = Math.round((dateScore * 0.6 + descScore * 0.4) * 100) / 100;
    return { extratoId: extrato.id, candidato: c, score, auto: false };
  }).sort((a, b) => b.score - a.score);

  if (scored.length === 1 && scored[0].score >= 0.45) {
    scored[0].auto = true;
  } else if (scored.length > 1 && scored[0].score >= 0.55 && scored[0].score - scored[1].score >= 0.15) {
    scored[0].auto = true;
  }
  return scored;
}

export function statusFromSugestoes(sugestoes: GestaoConciliacaoSugestao[]): "conciliado" | "confirmar" | "pendente" {
  if (!sugestoes.length) return "pendente";
  if (sugestoes[0].auto) return "conciliado";
  return "confirmar";
}
