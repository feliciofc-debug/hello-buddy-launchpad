import { inferGestaoCategoria } from "./gestao-categoria-pt.ts";
import { parseGestaoValorPt } from "./gestao-valor-pt.ts";
import { vehicleHintFromText } from "./gestao-veiculo-match.ts";
import { vendedorHintFromText } from "./gestao-vendedor-match.ts";

export type GestaoIntentKind =
  | "none"
  | "despesa"
  | "compra"
  | "venda"
  | "lucro_veiculo"
  | "lucro_mes"
  | "despesas_veiculo"
  | "desfazer"
  | "ranking_vendedores"
  | "vendedor_mes"
  | "comissao_mes"
  | "meta_bateu"
  | "venda_raiox"
  | "piores_negocios_mes"
  | "contas_amanha"
  | "contas_semana"
  | "a_receber"
  | "lucro_loja_mes"
  | "pacote_contador"
  | "revogar_link_contador";

export type GestaoIntent = {
  kind: GestaoIntentKind;
  valor: number | null;
  categoria: string | null;
  vehicleHint: string;
  vendedorHint: string;
  consignacao: boolean;
};

function normalize(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const BLOCK_VERB =
  /\b(lembre|lembra|agenda|agendar|post|postar|publica|cria|criar|arte|story|video|foto|imagem|campanha|vitrine|fipe|kbb)\b/;

export function classifyGestaoIntent(text: string): GestaoIntent {
  const empty: GestaoIntent = {
    kind: "none",
    valor: null,
    categoria: null,
    vehicleHint: "",
    vendedorHint: "",
    consignacao: false,
  };
  const t = normalize(text);
  if (!t || t.length < 4) return empty;
  if (BLOCK_VERB.test(t)) return empty;

  const vehicleHint = vehicleHintFromText(text);
  const valor = parseGestaoValorPt(text);

  if (/\bdesfaz(er)?(\s+ultim|\s+o\s+ultim|\s+lancamento)?/.test(t)) {
    return { ...empty, kind: "desfazer", vehicleHint };
  }

  if (/\bquanto\s+a\s+loja\s+lucrou\b|\blucro\s+liquido\s+da\s+loja\b|\bresultado\s+da\s+loja\b/.test(t)) {
    return { ...empty, kind: "lucro_loja_mes", vehicleHint };
  }

  if (/\bmanda(r)?\s+o?\s*relatorio\s+do\s+mes\s+(pro|para\s+o)\s+contador\b/.test(t)) {
    return { ...empty, kind: "pacote_contador", vehicleHint };
  }

  if (/\bcancela(r)?\s+o?\s*link\s+do\s+contador\b|\brevoga(r)?\s+link\s+contador\b/.test(t)) {
    return { ...empty, kind: "revogar_link_contador", vehicleHint };
  }

  if (/\bo\s+que\s+vence\s+essa\s+semana\b|\bvence\s+essa\s+semana\b/.test(t)) {
    return { ...empty, kind: "contas_semana", vehicleHint };
  }

  if (/\bvence\s+amanha\b|\bcontas?\s+amanha\b/.test(t)) {
    return { ...empty, kind: "contas_amanha", vehicleHint };
  }

  if (/\bquanto\s+tenho\s+a\s+receber\b|\ba\s+receber\b/.test(t) && !/\bpagar\b/.test(t)) {
    return { ...empty, kind: "a_receber", vehicleHint };
  }

  if (/\blucro\s+do\s+mes\b|\blucro\s+mensal\b|\bresultado\s+do\s+mes\b/.test(t)) {
    return { ...empty, kind: "lucro_mes", vehicleHint };
  }

  if (/\branking\s+(dos\s+)?vendedores\b|\branking\s+equipe\b/.test(t)) {
    return { ...empty, kind: "ranking_vendedores", vehicleHint };
  }

  if (/\bcomissao\s+do\s+mes\b|\bcomissões\s+do\s+mes\b/.test(t)) {
    return { ...empty, kind: "comissao_mes", vehicleHint };
  }

  if (/\bquem\s+bateu\s+a\s+meta\b|\bmeta\s+do\s+mes\b/.test(t)) {
    return { ...empty, kind: "meta_bateu", vehicleHint };
  }

  if (/\bpiores\s+negocios(\s+do\s+mes)?\b|\bpior\s+negocio\b/.test(t)) {
    return { ...empty, kind: "piores_negocios_mes", vehicleHint };
  }

  const vendedorHint = vendedorHintFromText(text);
  if (
    (/\bquanto\s+(o|a)\s+\w+\s+vendeu\b|\bvendas?\s+do\s+\w+/i.test(text) ||
      /\bvendeu\s+esse\s+mes\b/i.test(text)) &&
    vendedorHint.length >= 2
  ) {
    return { ...empty, kind: "vendedor_mes", vendedorHint, vehicleHint };
  }

  if (/\bcomo\s+foi\s+a\s+venda\b/.test(t) && vehicleHint.length >= 2) {
    return { ...empty, kind: "venda_raiox", vehicleHint };
  }

  if (
    /\b(quanto\s+lucrei|lucro\s+no|lucro\s+do|margem\s+no)\b/.test(t) &&
    vehicleHint.length >= 2
  ) {
    return { ...empty, kind: "lucro_veiculo", vehicleHint };
  }

  if (/\bdespesas?\s+(do|no|na)\b/.test(t) && vehicleHint.length >= 2) {
    return { ...empty, kind: "despesas_veiculo", vehicleHint };
  }

  const consignacao = /\bconsign/.test(t);

  if (/\bvendi\b/.test(t) && valor != null && vehicleHint.length >= 2) {
    return {
      kind: "venda",
      valor,
      categoria: null,
      vehicleHint,
      vendedorHint: vendedorHintFromText(text),
      consignacao: false,
    };
  }

  if (/\bcomprei\b/.test(t) && valor != null && vehicleHint.length >= 2) {
    return {
      kind: "compra",
      valor,
      categoria: null,
      vehicleHint,
      vendedorHint: "",
      consignacao,
    };
  }

  if (
    (/\bgastei\b|\bpaguei\b|\bdespesa\b/.test(t) || inferGestaoCategoria(text) !== "outros") &&
    valor != null &&
    vehicleHint.length >= 2
  ) {
    return {
      kind: "despesa",
      valor,
      categoria: inferGestaoCategoria(text),
      vehicleHint,
      vendedorHint: "",
      consignacao: false,
    };
  }

  return empty;
}

export function isGestaoAffirmative(text: string): boolean {
  const t = normalize(text);
  return /^(sim|s|confirmo|confirmar|pode|ok|isso|certo)\b/.test(t);
}

export function isGestaoNegative(text: string): boolean {
  const t = normalize(text);
  return /^(nao|não|n|cancelar|cancela|desistir)\b/.test(t);
}

/** Resposta numérica na desambiguação: "2", "opção 2", "o 2". */
export function parseGestaoDisambiguationPick(text: string): number | null {
  const t = normalize(text).replace(/[.!?,]/g, " ").trim();
  const opcao = t.match(/^(?:opcao|opção|o)\s*(\d{1,2})$/);
  if (opcao) {
    const n = Number(opcao[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (/^\d{1,2}$/.test(t)) {
    const n = Number(t);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}
