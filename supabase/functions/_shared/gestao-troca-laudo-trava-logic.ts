/** Espelha a regra do trigger gestao_troca_laudo_trava_update (testes Deno). */

export const GESTAO_TROCA_LAUDO_TRAVA_MSG =
  "Laudo finalizado: reabra o laudo para alterar.";

export const GESTAO_TROCA_LAUDO_COLUNAS_SERVICE_ONLY = [
  "laudo_status",
  "laudo_numero",
  "laudo_versao",
  "laudo_finalizado_por",
  "laudo_finalizado_em",
  "laudo_reaberto_motivo",
] as const;

export const GESTAO_TROCA_LAUDO_BLOQUEIO_SE_FINALIZADO = [
  "checklist_json",
  "fotos_json",
  "kbb_troca",
  "kbb_loja",
  "kbb_km_caracteristico",
  "fipe_valor",
  "fipe_mes_ref",
  "preparacao_estimada",
  "valor_proposto",
  "valor_sugerido",
  "faixa_verde_min",
  "faixa_verde_max",
  "teto",
  "semaforo",
  "justificativas_json",
  "km",
  "placa",
  "marca",
  "modelo",
  "versao",
  "ano_fabricacao",
  "ano_modelo",
  "cor",
  "categoria",
] as const;

function distinct(a: unknown, b: unknown): boolean {
  if (a === b) return false;
  if (a == null && b == null) return false;
  if (typeof a === "object" && typeof b === "object" && a && b) {
    return JSON.stringify(a) !== JSON.stringify(b);
  }
  return true;
}

export function assertGestaoTrocaLaudoTravaUpdate(input: {
  isServiceRole: boolean;
  oldRow: Record<string, unknown>;
  newRow: Record<string, unknown>;
}): void {
  if (input.isServiceRole) return;

  for (const col of GESTAO_TROCA_LAUDO_COLUNAS_SERVICE_ONLY) {
    if (distinct(input.oldRow[col], input.newRow[col])) {
      throw new Error(GESTAO_TROCA_LAUDO_TRAVA_MSG);
    }
  }

  if (String(input.oldRow.laudo_status ?? "rascunho") !== "finalizado") return;

  for (const col of GESTAO_TROCA_LAUDO_BLOQUEIO_SE_FINALIZADO) {
    if (distinct(input.oldRow[col], input.newRow[col])) {
      throw new Error(GESTAO_TROCA_LAUDO_TRAVA_MSG);
    }
  }
}
