import { formatYmdSaoPaulo } from "./gestao-date-br.ts";

export type GestaoMetaTipo = "qtd" | "faturamento" | "lucro";

export type GestaoBonusEscalonado = {
  pctMeta: number;
  bonus: number;
};

export type GestaoMetaConfigJson = {
  tipo: GestaoMetaTipo;
  metaValor: number;
  bonusEscalonado: GestaoBonusEscalonado[];
  bonusCarroParado90: number;
};

export type GestaoMetaProgresso = {
  realizado: number;
  meta: number;
  pctAtingido: number;
  projecaoPct: number;
  bonusEstimado: number;
};

export function competenciaFromDate(d = new Date()): string {
  return formatYmdSaoPaulo(d).slice(0, 7);
}

export function calcMetaProgresso(
  config: GestaoMetaConfigJson,
  realizado: number,
  now = new Date(),
): GestaoMetaProgresso {
  const meta = config.metaValor;
  const pctAtingido = meta > 0 ? (realizado / meta) * 100 : 0;
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projecaoPct = day > 0 ? (pctAtingido / day) * daysInMonth : pctAtingido;

  let bonusEstimado = 0;
  const sorted = [...config.bonusEscalonado].sort((a, b) => b.pctMeta - a.pctMeta);
  for (const tier of sorted) {
    if (projecaoPct >= tier.pctMeta) {
      bonusEstimado = tier.bonus;
      break;
    }
  }

  return {
    realizado,
    meta,
    pctAtingido: Math.round(pctAtingido * 10) / 10,
    projecaoPct: Math.round(projecaoPct * 10) / 10,
    bonusEstimado,
  };
}
