export type PortalIntegrationStatus = "em_liberacao" | "em_breve";

export type PortalIntegrationDefinition = {
  id: string;
  name: string;
  description: string;
  status: PortalIntegrationStatus;
};

export const PORTAL_STATUS_LABEL: Record<PortalIntegrationStatus, string> = {
  em_liberacao: "Em liberação",
  em_breve: "Em breve",
};

/** Portais visuais (sem integração) — ordem de exibição na tela Integrações. */
export const PLANNED_PORTAL_INTEGRATIONS: PortalIntegrationDefinition[] = [
  {
    id: "olx",
    name: "OLX",
    description: "Publique veículos no classificados OLX.",
    status: "em_liberacao",
  },
  {
    id: "facebook-marketplace",
    name: "Facebook Marketplace",
    description: "Anúncios de veículos no Marketplace do Facebook.",
    status: "em_breve",
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Divulgação de estoque em formatos curtos no TikTok.",
    status: "em_breve",
  },
  {
    id: "chaves-na-mao",
    name: "Chaves na Mão",
    description: "Portal Chaves na Mão para revendas.",
    status: "em_breve",
  },
  {
    id: "socarrao",
    name: "SóCarrão",
    description: "Listagem no SóCarrão.",
    status: "em_breve",
  },
  {
    id: "usadosbr",
    name: "Usadosbr",
    description: "Integração com Usadosbr.",
    status: "em_breve",
  },
  {
    id: "napista",
    name: "NaPista",
    description: "Portal NaPista para anúncios automotivos.",
    status: "em_breve",
  },
  {
    id: "portais-regionais",
    name: "Portais regionais",
    description: "Outros classificados e portais locais do seu mercado.",
    status: "em_breve",
  },
];
