import { parseGestaoMoneyBr } from "./gestao-money-parse.ts";

export type GestaoTrocaPreservedPricing = {
  kbb_troca: number | null;
  kbb_loja: number | null;
  kbb_km_caracteristico: number | null;
  preparacao_estimada: number;
  valor_proposto: number | null;
};

export function gestaoTrocaMoneyTextFromStored(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Reformata após blur (mantém vazio se inválido). */
export function formatGestaoTrocaMoneyBlurText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const n = parseGestaoMoneyBr(raw);
  if (n == null) return raw;
  return gestaoTrocaMoneyTextFromStored(n);
}

export function gestaoTrocaSnapshotPreservedPricing(input: {
  kbb_troca: number | null;
  kbb_loja: number | null;
  kbb_km_caracteristico: number | null;
  preparacao_estimada: number;
  valor_proposto: number | null;
  texts: {
    kbbTroca: string;
    kbbLoja: string;
    preparacao: string;
    valorProposto: string;
  };
}): GestaoTrocaPreservedPricing {
  return {
    kbb_troca: parseGestaoMoneyBr(input.texts.kbbTroca) ?? input.kbb_troca,
    kbb_loja: parseGestaoMoneyBr(input.texts.kbbLoja) ?? input.kbb_loja,
    kbb_km_caracteristico: input.kbb_km_caracteristico,
    preparacao_estimada: parseGestaoMoneyBr(input.texts.preparacao) ??
      input.preparacao_estimada,
    valor_proposto: parseGestaoMoneyBr(input.texts.valorProposto) ?? input.valor_proposto,
  };
}

/** Patch enviado ao salvar FIPE — nunca inclui KBB. */
export function gestaoTrocaPatchSomenteFipe(
  fipe_valor: number,
  fipe_mes_ref: string,
): { fipe_valor: number; fipe_mes_ref: string } {
  return { fipe_valor, fipe_mes_ref };
}

export function gestaoTrocaMergeFipePreservandoKbb<T extends GestaoTrocaPreservedPricing>(
  base: T,
  fipe_valor: number,
  fipe_mes_ref: string,
  preserved: GestaoTrocaPreservedPricing,
): T & { fipe_valor: number; fipe_mes_ref: string } {
  return {
    ...base,
    ...preserved,
    fipe_valor,
    fipe_mes_ref,
  };
}
