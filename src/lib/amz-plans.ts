export const AMZ_PLANS = [
  {
    id: 'essencial',
    name: 'Essencial',
    price: 597,
    summary: 'Presença digital consistente para sua empresa.',
    features: [
      'Até 60 posts por mês',
      'Criação e gestão de conteúdo',
      'Sem agente de IA',
      'Sem atendimento por WhatsApp',
    ],
  },
  {
    id: 'profissional',
    name: 'Profissional',
    price: 997,
    summary: 'Toda a plataforma liberada, sem limite de posts.',
    features: [
      'Tudo do plano Essencial',
      'Posts ilimitados',
      'Todas as ferramentas liberadas',
      'Automação completa de conteúdo',
    ],
    featured: true,
  },
  {
    id: 'avancado',
    name: 'Avançado com IA',
    price: 1597,
    summary: 'Conteúdo e atendimento comercial no mesmo plano.',
    features: [
      'Tudo do plano Profissional',
      'Agente de IA para atendimento',
      'Atendimento aos clientes no WhatsApp da empresa',
      'Operação comercial assistida por IA',
    ],
  },
] as const;

export type AmzPlanId = (typeof AMZ_PLANS)[number]['id'];

export const DEFAULT_AMZ_PLAN_ID: AmzPlanId = 'essencial';

export function isAmzPlanId(value: string | null | undefined): value is AmzPlanId {
  return AMZ_PLANS.some((plan) => plan.id === value);
}

export function getAmzPlan(value: string | null | undefined) {
  return AMZ_PLANS.find((plan) => plan.id === value)
    ?? AMZ_PLANS.find((plan) => plan.id === DEFAULT_AMZ_PLAN_ID)!;
}

export function formatPlanPrice(price: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(price);
}
