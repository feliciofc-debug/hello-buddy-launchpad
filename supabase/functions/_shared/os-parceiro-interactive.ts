export const OS_COT_WA_PREFIX = "os_cot_wa:";

export function osCotacaoWaInteractiveId(action: string): string {
  return `${OS_COT_WA_PREFIX}${action}`;
}

export function parseOsCotacaoWaInteractiveId(text: string): string | null {
  const m = String(text || "").match(/<<INTERACTIVE_ID:os_cot_wa:([^>]+)>>/i);
  return m?.[1]?.trim() || null;
}

export function extractOsCotacaoWaButtonId(payload: Record<string, unknown> | null | undefined): string {
  const p = payload as {
    interactive?: { button_reply?: { id?: string } };
    button?: { payload?: string };
  } | undefined;
  return String(
    p?.interactive?.button_reply?.id ?? p?.button?.payload ?? "",
  );
}

export const OS_COT_WA_BTN_ENVIAR = osCotacaoWaInteractiveId("enviar_orcamento");
export const OS_COT_WA_BTN_SEM_AGENDA = osCotacaoWaInteractiveId("sem_agenda");
export const OS_COT_WA_BTN_CONFIRMAR = osCotacaoWaInteractiveId("confirmar_sim");
export const OS_COT_WA_BTN_CORRIGIR = osCotacaoWaInteractiveId("confirmar_corrigir");
