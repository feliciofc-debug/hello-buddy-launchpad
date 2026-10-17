export type GestaoBonusRow = {
  id: string;
  competencia: string;
  valor: number;
  motivo: string;
};

export type GestaoContaBonusLink = {
  id: string;
  bonus_mensal_id: string | null;
  valor: number;
  vencimento: string;
};

/** Último dia do mês da competência YYYY-MM. */
export function vencimentoFromCompetencia(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${competencia}-${String(lastDay).padStart(2, "0")}`;
}

export function planBonusOperacionalUpserts(
  bonuses: GestaoBonusRow[],
  existing: GestaoContaBonusLink[],
): Array<{
  bonus_mensal_id: string;
  valor: number;
  vencimento: string;
  observacao: string;
  existingId: string | null;
}> {
  const byBonus = new Map(
    existing.filter((e) => e.bonus_mensal_id).map((e) => [e.bonus_mensal_id!, e]),
  );
  return bonuses.map((b) => {
    const prev = byBonus.get(b.id);
    return {
      bonus_mensal_id: b.id,
      valor: b.valor,
      vencimento: vencimentoFromCompetencia(b.competencia),
      observacao: `Bônus G2: ${b.motivo}`,
      existingId: prev?.id ?? null,
    };
  });
}
