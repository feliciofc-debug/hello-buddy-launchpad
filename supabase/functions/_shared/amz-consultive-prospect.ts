export const AMZ_INVITE_DISCOVERY_MESSAGE =
  "Que ótimo, {nome}! Me conta: qual é o seu negócio? E vocês têm site ou Instagram? Se tiver site, me manda o endereço, por exemplo: www.suaempresa.com.br";

type InviteTemplate = {
  nome_meta?: string | null;
  tipo_uso?: string | null;
  variaveis_map?: Record<string, unknown> | null;
};

function firstName(value?: string | null): string {
  return String(value || "").trim().split(/\s+/)[0] || "tudo bem";
}

export function resolveInviteConfirmation(params: {
  isAmzTenant: boolean;
  template?: InviteTemplate | null;
  contactName?: string | null;
  fallback: string;
}): string {
  const template = params.template;
  const isInvite = template?.nome_meta === "convite_pietro_amz_v1"
    || ["convite", "convite_optin"].includes(String(template?.tipo_uso || ""));
  if (!params.isAmzTenant || !isInvite) return params.fallback;

  const configured = String(
    template?.variaveis_map?.confirmation_message
      ?? template?.variaveis_map?.mensagem_confirmacao
      ?? "",
  ).trim();
  const message = configured || AMZ_INVITE_DISCOVERY_MESSAGE;
  return message.replaceAll("{nome}", firstName(params.contactName));
}

export function normalizeProspectBrandColors(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values
    .map((value) => String(value || "").trim().toLowerCase())
    .filter((value) => /^#[0-9a-f]{6}$/.test(value)))]
    .slice(0, 6);
}

export function prospectDemoBrandPlan(params: {
  isAmzProspect: boolean;
  siteUrl?: string | null;
  brandColors?: unknown;
}): {
  siteUrl: string | null;
  brandColors: string[];
  useTemporarySiteIdentity: boolean;
  persistIdentity: false;
  allowPublishing: false;
} {
  const siteUrl = params.isAmzProspect ? String(params.siteUrl || "").trim() || null : null;
  return {
    siteUrl,
    brandColors: params.isAmzProspect ? normalizeProspectBrandColors(params.brandColors) : [],
    useTemporarySiteIdentity: Boolean(siteUrl),
    persistIdentity: false,
    allowPublishing: false,
  };
}

export type AmzLeadSummary = {
  business?: string | null;
  pain?: string | null;
  demonstration?: string | null;
  nextStep?: string | null;
};

export function buildAmzLeadOwnerSummary(summary: AmzLeadSummary): string[] {
  return [
    summary.business ? `Negócio: ${summary.business}` : null,
    summary.pain ? `Dor: ${summary.pain}` : null,
    summary.demonstration ? `Demonstração: ${summary.demonstration}` : null,
    summary.nextStep ? `Próximo passo: ${summary.nextStep}` : null,
  ].filter((line): line is string => Boolean(line));
}

export function amzProspectHandoffInstruction(): string {
  return "Avise o prospect que um consultor da AMZ vai entrar em contato.";
}
