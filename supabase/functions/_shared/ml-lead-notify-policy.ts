/** Lead de anúncio publicado pela AMZ (veiculos_portais) vs outro integrador. */
export type MlLeadOrigem = "amz" | "outro_sistema";

export function mlLeadOrigemFromPortal(hasAmzPortal: boolean): MlLeadOrigem {
  return hasAmzPortal ? "amz" : "outro_sistema";
}

/** WhatsApp ao dono: default só leads AMZ; opcional todos os anúncios da conta ML. */
export function shouldNotifyMlLeadOnWhatsApp(input: {
  hasAmzPortal: boolean;
  whatsappLeadsAllAds: boolean;
}): boolean {
  return input.hasAmzPortal || input.whatsappLeadsAllAds;
}

/** Leads: ownership (veiculos_portais) classifica origem; opt-in pode notificar outros integradores. */
export function resolveMlVisLeadNotification(input: {
  ownedByAmz: boolean;
  whatsappLeadsAllAds: boolean;
}): { origem: MlLeadOrigem; notifyWhatsapp: boolean } {
  return {
    origem: mlLeadOrigemFromPortal(input.ownedByAmz),
    notifyWhatsapp: shouldNotifyMlLeadOnWhatsApp({
      hasAmzPortal: input.ownedByAmz,
      whatsappLeadsAllAds: input.whatsappLeadsAllAds,
    }),
  };
}
