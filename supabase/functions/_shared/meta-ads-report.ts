export type MetaAdsPeriod =
  | "hoje"
  | "ontem"
  | "7_dias"
  | "30_dias"
  | "este_mes";

export type MetaAdsIntegration = {
  access_token: string;
  token_expires_at?: string | null;
  ad_account_id?: string | null;
  ad_account_name?: string | null;
  ad_account_currency?: string | null;
  is_active?: boolean | null;
};

export type MetaAdsInsight = {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: Array<{ action_type?: string; value?: string }>;
  cost_per_action_type?: Array<{
    action_type?: string;
    value?: string;
  }>;
  purchase_roas?: Array<{ action_type?: string; value?: string }>;
};

type CacheEntry = { expiresAt: number; value: string };
const CACHE_TTL_MS = 10 * 60 * 1000;
const reportCache = new Map<string, CacheEntry>();

export const META_ADS_PERIODS: Record<
  MetaAdsPeriod,
  { preset: string; label: string }
> = {
  hoje: { preset: "today", label: "hoje" },
  ontem: { preset: "yesterday", label: "ontem" },
  "7_dias": { preset: "last_7d", label: "últimos 7 dias" },
  "30_dias": { preset: "last_30d", label: "últimos 30 dias" },
  este_mes: { preset: "this_month", label: "este mês" },
};

const CONNECT_URL = "https://www.amzofertas.com.br/configuracoes";
export const META_ADS_INSIGHT_FIELDS = [
  "spend",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "actions",
  "cost_per_action_type",
  "purchase_roas",
].join(",");

export function normalizeMetaAdsPeriod(value: unknown): MetaAdsPeriod {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (normalized === "hoje") return "hoje";
  if (normalized === "ontem") return "ontem";
  if (["30_dias", "ultimos_30_dias"].includes(normalized)) return "30_dias";
  if (["este_mes", "mes_atual"].includes(normalized)) return "este_mes";
  return "7_dias";
}

const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

function dateInTimeZone(timestamp: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function metaAdsPeriodParams(
  period: MetaAdsPeriod,
  now: number,
): Record<string, string> {
  if (period !== "7_dias") {
    return { date_preset: META_ADS_PERIODS[period].preset };
  }
  const today = dateInTimeZone(now, SAO_PAULO_TIME_ZONE);
  const [year, month, day] = today.split("-").map(Number);
  const localCalendarDay = Date.UTC(year, month - 1, day);
  return {
    time_range: JSON.stringify({
      since: new Date(localCalendarDay - 6 * 86_400_000)
        .toISOString().slice(0, 10),
      until: today,
    }),
  };
}

export function isMetaAdsReportRequest(value: unknown): boolean {
  const text = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return [
    /\bcomo (?:estao|foram) (?:os )?meus anuncios\b/,
    /\brelatorio (?:de|dos) anuncios\b/,
    /\bquanto (?:eu )?gastei (?:em|nos?) anuncios\b/,
    /\bresultado (?:da|das|de) campanha/,
  ].some((pattern) => pattern.test(text));
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function brl(value: unknown): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(number(value));
}

function decimal(value: unknown, digits = 2): string {
  return number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function integer(value: unknown): string {
  return Math.round(number(value)).toLocaleString("pt-BR");
}

export function metaAdsActionValue(
  rows: MetaAdsInsight["actions"],
  actionType: string,
): number | null {
  const found = rows?.find((row) => row.action_type === actionType);
  return found ? number(found.value) : null;
}

function relevantResults(insight: MetaAdsInsight): string[] {
  const definitions = [
    {
      type: "onsite_conversion.messaging_conversation_started_7d",
      label: "Conversas iniciadas",
    },
    { type: "lead", label: "Leads" },
    { type: "purchase", label: "Compras" },
  ];
  const lines: string[] = [];
  for (const definition of definitions) {
    const total = metaAdsActionValue(insight.actions, definition.type);
    if (total === null) continue;
    const cost = metaAdsActionValue(
      insight.cost_per_action_type,
      definition.type,
    );
    lines.push(
      `${definition.label}: ${integer(total)}${
        cost === null ? "" : ` (${brl(cost)} cada)`
      }`,
    );
  }
  const roas = metaAdsActionValue(insight.purchase_roas, "omni_purchase") ??
    metaAdsActionValue(insight.purchase_roas, "purchase");
  if (roas !== null) lines.push(`ROAS de compras: ${decimal(roas)}x`);
  return lines;
}

export function formatMetaAdsReport(input: {
  period: MetaAdsPeriod;
  accountName?: string | null;
  account?: MetaAdsInsight | null;
  campaigns?: MetaAdsInsight[];
}): string {
  const label = META_ADS_PERIODS[input.period].label;
  const account = input.account;
  if (!account) {
    return `📊 Meta Ads — ${label}\n\nNão houve dados de anúncios nesse período.`;
  }

  const lines = [
    `📊 Meta Ads — ${label}`,
    input.accountName ? `Conta: ${input.accountName}` : null,
    "",
    `Gasto: ${brl(account.spend)}`,
    `Impressões: ${integer(account.impressions)} | Alcance: ${
      integer(account.reach)
    }`,
    `Cliques: ${integer(account.clicks)} | CTR: ${
      decimal(account.ctr)
    }%`,
    `CPC: ${brl(account.cpc)} | CPM: ${brl(account.cpm)} | Frequência: ${
      decimal(account.frequency)
    }`,
  ].filter((line): line is string => line !== null);

  const results = relevantResults(account);
  if (results.length) lines.push("", ...results);

  const campaigns = (input.campaigns ?? []).slice(0, 5);
  if (campaigns.length) {
    lines.push("", "Top campanhas por gasto:");
    campaigns.forEach((campaign, index) => {
      lines.push(
        `${index + 1}. ${
          campaign.campaign_name || "Campanha sem nome"
        } — ${brl(campaign.spend)} | CTR ${decimal(campaign.ctr)}%`,
      );
    });
  }
  return lines.join("\n");
}

function cacheGet(key: string, now: number): string | null {
  const cached = reportCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    reportCache.delete(key);
    return null;
  }
  return cached.value;
}

function cacheSet(key: string, value: string, now: number): string {
  reportCache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

export function clearMetaAdsReportCache(): void {
  reportCache.clear();
}

export async function getMetaAdsReport(input: {
  userId: string;
  period?: unknown;
  loadIntegration: (
    userId: string,
  ) => Promise<MetaAdsIntegration | null>;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<string> {
  const period = normalizeMetaAdsPeriod(input.period);
  const now = input.now ?? Date.now();
  const integration = await input.loadIntegration(input.userId);
  if (!integration?.is_active || !integration.access_token) {
    return `O Meta Ads ainda não está conectado. Conecte em ${CONNECT_URL}`;
  }
  const expiresAt = Date.parse(String(integration.token_expires_at ?? ""));
  if (Number.isFinite(expiresAt) && expiresAt <= now) {
    return `A conexão do Meta Ads venceu. Reconecte em ${CONNECT_URL}`;
  }
  if (!integration.ad_account_id) {
    return `Escolha uma conta de anúncios em ${CONNECT_URL}`;
  }

  const periodParams = metaAdsPeriodParams(period, now);
  const cacheKey = `${integration.ad_account_id}:${period}:${
    periodParams.time_range ?? periodParams.date_preset
  }`;
  const cached = cacheGet(cacheKey, now);
  if (cached) return cached;

  const fetchImpl = input.fetchImpl ?? fetch;
  const loadInsights = async (
    level: "account" | "campaign",
  ): Promise<MetaAdsInsight[]> => {
    const url = new URL(
      `https://graph.facebook.com/v25.0/${integration.ad_account_id}/insights`,
    );
    url.searchParams.set(
      "fields",
      level === "campaign"
        ? `campaign_id,campaign_name,${META_ADS_INSIGHT_FIELDS}`
        : META_ADS_INSIGHT_FIELDS,
    );
    url.searchParams.set("level", level);
    Object.entries(periodParams).forEach(([key, value]) =>
      url.searchParams.set(key, value)
    );
    url.searchParams.set("limit", level === "campaign" ? "5" : "1");
    if (level === "campaign") {
      url.searchParams.set("sort", "spend_descending");
    }
    url.searchParams.set("access_token", integration.access_token);

    const response = await fetchImpl(url);
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.error) {
      const code = Number(body?.error?.code || 0);
      if ([17, 613, 80004].includes(code)) {
        throw new Error("META_RATE_LIMIT");
      }
      if ([102, 190, 200].includes(code) || response.status === 401) {
        throw new Error("META_TOKEN");
      }
      throw new Error("META_REQUEST");
    }
    return Array.isArray(body?.data) ? body.data : [];
  };

  try {
    const accountRows = await loadInsights("account");
    if (!accountRows.length) {
      return cacheSet(
        cacheKey,
        formatMetaAdsReport({ period, account: null }),
        now,
      );
    }
    const campaigns = await loadInsights("campaign");
    return cacheSet(
      cacheKey,
      formatMetaAdsReport({
        period,
        accountName: integration.ad_account_name,
        account: accountRows[0],
        campaigns,
      }),
      now,
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "META_REQUEST";
    const message = code === "META_RATE_LIMIT"
      ? "A Meta limitou as consultas agora. Tente novamente em alguns minutos."
      : code === "META_TOKEN"
      ? `A conexão do Meta Ads venceu ou está sem permissão. Reconecte em ${CONNECT_URL}`
      : "Não consegui consultar o Meta Ads agora. Tente novamente em alguns minutos.";
    return message;
  }
}
