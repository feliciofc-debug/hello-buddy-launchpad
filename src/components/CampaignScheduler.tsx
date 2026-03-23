/**
 * Dispatcher interno desativado:
 * o frontend não deve fazer polling/disparo de campanhas.
 * O fluxo é exclusivamente "queue-only".
 */
export function CampaignScheduler() {
  return null;
}

