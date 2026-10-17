import { categoriaCompativelComExtrato } from "./gestao-conciliacao-categoria.ts";

export const GESTAO_CONCILIACAO_DIAS_TOLERANCIA = 3;
export const GESTAO_CONCILIACAO_DIAS_AUTO = 1;

export type GestaoConciliacaoCandidato = {
  tipo: "conta_pagar" | "conta_receber" | "veiculo_despesa" | "veiculo_venda" | "comissao_extrato";
  refId: string;
  data: string;
  valor: number;
  descricao: string;
  liquidado: boolean;
  categoria?: string;
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

export function refKeyCandidato(c: { tipo: string; refId: string }): string {
  return `${c.tipo}:${c.refId}`;
}

function daysDiff(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  return Math.abs(Math.floor((da.getTime() - db.getTime()) / 86400000));
}

export function descricaoScore(a: string, b: string): number {
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

function sentidoOk(extrato: GestaoExtratoParaMatch, c: GestaoConciliacaoCandidato): boolean {
  if (extrato.sentido === "debito") {
    return c.tipo === "conta_pagar" || c.tipo === "veiculo_despesa" || c.tipo === "comissao_extrato";
  }
  return c.tipo === "conta_receber" || c.tipo === "veiculo_venda";
}

function podeAutoConciliar(
  extrato: GestaoExtratoParaMatch,
  candidato: GestaoConciliacaoCandidato,
  poolMesmoValor: GestaoConciliacaoCandidato[],
): boolean {
  if (!valorMatch(extrato.valor, candidato.valor)) return false;
  if (daysDiff(extrato.data, candidato.data) > GESTAO_CONCILIACAO_DIAS_AUTO) return false;

  const unicosAuto = poolMesmoValor.filter((c) =>
    sentidoOk(extrato, c) &&
    valorMatch(extrato.valor, c.valor) &&
    daysDiff(extrato.data, c.data) <= GESTAO_CONCILIACAO_DIAS_AUTO,
  );
  if (unicosAuto.length !== 1 || unicosAuto[0]!.refId !== candidato.refId) return false;

  const descOk = descricaoScore(extrato.descricao, candidato.descricao) >= 0.2;
  const catOk = categoriaCompativelComExtrato(extrato.descricao, candidato.categoria);
  return descOk || catOk;
}

export function matchExtratoComCandidatos(
  extrato: GestaoExtratoParaMatch,
  candidatos: GestaoConciliacaoCandidato[],
  opts?: { diasTolerancia?: number; refsOcupados?: Set<string> },
): GestaoConciliacaoSugestao[] {
  const diasTolerancia = opts?.diasTolerancia ?? GESTAO_CONCILIACAO_DIAS_TOLERANCIA;
  const refsOcupados = opts?.refsOcupados ?? new Set<string>();

  const pool = candidatos.filter((c) => !refsOcupados.has(refKeyCandidato(c)))
    .filter((c) => sentidoOk(extrato, c))
    .filter((c) => valorMatch(extrato.valor, c.valor))
    .filter((c) => daysDiff(extrato.data, c.data) <= diasTolerancia);

  const scored = pool.map((c) => {
    const dateScore = 1 - Math.min(daysDiff(extrato.data, c.data), diasTolerancia) / (diasTolerancia + 1);
    const descScore = descricaoScore(extrato.descricao, c.descricao);
    const score = Math.round((dateScore * 0.6 + descScore * 0.4) * 100) / 100;
    const auto = podeAutoConciliar(extrato, c, pool);
    return { extratoId: extrato.id, candidato: c, score, auto };
  }).sort((a, b) => b.score - a.score);

  return scored;
}

export function statusFromSugestoes(sugestoes: GestaoConciliacaoSugestao[]): "conciliado" | "confirmar" | "pendente" {
  if (!sugestoes.length) return "pendente";
  if (sugestoes.some((s) => s.auto)) return "conciliado";
  return "confirmar";
}

export type ExtratoComSugestoesInput = {
  id: string;
  data: string;
  valor: number;
  sugestoes: GestaoConciliacaoSugestao[];
};

/** Atribuição gulosa: cada candidato no máximo uma transação (maior score primeiro). */
export function atribuirAutoMatchesGreedy(
  extratos: ExtratoComSugestoesInput[],
): Array<{ extratoId: string; sug: GestaoConciliacaoSugestao }> {
  const pares: Array<{ extratoId: string; sug: GestaoConciliacaoSugestao }> = [];
  for (const e of extratos) {
    const top = e.sugestoes.find((s) => s.auto);
    if (top) pares.push({ extratoId: e.id, sug: top });
  }
  pares.sort((a, b) => b.sug.score - a.sug.score);

  const refsUsados = new Set<string>();
  const extratosUsados = new Set<string>();
  const out: Array<{ extratoId: string; sug: GestaoConciliacaoSugestao }> = [];

  for (const p of pares) {
    if (extratosUsados.has(p.extratoId)) continue;
    const rk = refKeyCandidato(p.sug.candidato);
    if (refsUsados.has(rk)) continue;
    refsUsados.add(rk);
    extratosUsados.add(p.extratoId);
    out.push(p);
  }
  return out;
}
