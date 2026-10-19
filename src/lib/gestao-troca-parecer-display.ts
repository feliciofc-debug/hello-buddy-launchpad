import type { GestaoTrocaIaDescricaoAreaRow } from "@/lib/gestao-troca-ia-descricao-display.ts";
import type { GestaoTrocaLaudoDescricaoPdf } from "@/lib/gestao-troca-ia-descricao-display.ts";

export type GestaoTrocaParecerRecomendacaoView = {
  rotulo: string;
  motivos: string[];
  pendencias: string[];
};

export type GestaoTrocaParecerPreviewView = {
  recomendacao: GestaoTrocaParecerRecomendacaoView;
  paragrafo_ia: string | null;
  descricao: GestaoTrocaLaudoDescricaoPdf | null;
};

function parseRecomendacao(raw: unknown): GestaoTrocaParecerRecomendacaoView | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    rotulo: String(o.rotulo ?? ""),
    motivos: Array.isArray(o.motivos) ? o.motivos.map((m) => String(m)) : [],
    pendencias: Array.isArray(o.pendencias) ? o.pendencias.map((p) => String(p)) : [],
  };
}

function parseDescricaoPdf(raw: unknown): GestaoTrocaLaudoDescricaoPdf | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const externo = Array.isArray(o.externo) ? (o.externo as GestaoTrocaIaDescricaoAreaRow[]) : [];
  const interno = Array.isArray(o.interno) ? (o.interno as GestaoTrocaIaDescricaoAreaRow[]) : [];
  const conclusao = o.conclusao_visual != null ? String(o.conclusao_visual) : null;
  if (!externo.length && !interno.length && !conclusao) return null;
  return { externo, interno, conclusao_visual: conclusao };
}

export function mapGestaoTrocaParecerPreviewFromApi(input: {
  recomendacao?: Record<string, unknown>;
  paragrafo_ia?: string | null;
  descricao?: Record<string, unknown> | null;
}): GestaoTrocaParecerPreviewView | null {
  const recomendacao = parseRecomendacao(input.recomendacao);
  if (!recomendacao) return null;
  return {
    recomendacao,
    paragrafo_ia: input.paragrafo_ia ?? null,
    descricao: parseDescricaoPdf(input.descricao),
  };
}

/** Snapshot gravado em gestao_troca.parecer_json (fatos + parágrafo). */
export function parseGestaoTrocaParecerJson(
  raw: unknown,
): GestaoTrocaParecerPreviewView | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const recomendacao = parseRecomendacao(o.recomendacao);
  if (!recomendacao) return null;
  const laudo = o.laudo_descritivo;
  return {
    recomendacao,
    paragrafo_ia: o.paragrafo_ia != null ? String(o.paragrafo_ia) : null,
    descricao: parseDescricaoPdf(laudo),
  };
}
