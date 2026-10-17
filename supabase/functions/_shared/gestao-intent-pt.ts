import { inferGestaoCategoria } from "./gestao-categoria-pt.ts";
import { parseGestaoValorPt } from "./gestao-valor-pt.ts";
import { vehicleHintFromText } from "./gestao-veiculo-match.ts";

export type GestaoIntentKind =
  | "none"
  | "despesa"
  | "compra"
  | "venda"
  | "lucro_veiculo"
  | "lucro_mes"
  | "despesas_veiculo"
  | "desfazer";

export type GestaoIntent = {
  kind: GestaoIntentKind;
  valor: number | null;
  categoria: string | null;
  vehicleHint: string;
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

  if (/\blucro\s+do\s+mes\b|\blucro\s+mensal\b|\bresultado\s+do\s+mes\b/.test(t)) {
    return { ...empty, kind: "lucro_mes", vehicleHint };
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
      consignacao: false,
    };
  }

  if (/\bcomprei\b/.test(t) && valor != null && vehicleHint.length >= 2) {
    return {
      kind: "compra",
      valor,
      categoria: null,
      vehicleHint,
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
