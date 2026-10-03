import {
  META_ADS_INSIGHT_FIELDS,
  META_ADS_PERIODS,
  metaAdsActionValue,
  normalizeMetaAdsPeriod,
  type MetaAdsInsight,
  type MetaAdsIntegration,
  type MetaAdsPeriod,
} from "./meta-ads-report.ts";

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<
  string,
  { expiresAt: number; value: MetaAdsDashboardSuccess }
>();

type MetricSummary = {
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversations: number | null;
  leads: number | null;
  purchases: number | null;
  roas: number | null;
  result_type: "conversation" | "lead" | "purchase" | null;
  results: number | null;
  cost_per_result: number | null;
};

export type MetaAdsDashboardSuccess = {
  ok: true;
  cached: boolean;
  period: MetaAdsPeriod;
  account: {
    id: string;
    name: string | null;
    currency: string;
  };
  has_data: boolean;
  summary: MetricSummary | null;
  daily: Array<{
    date: string;
    spend: number;
    clicks: number;
    conversations: number;
  }>;
  campaigns: Array<{
    id: string;
    graph_id: string | null;
    platform_id: string | null;
    source: "platform" | "meta";
    name: string;
    status: string;
    spend: number;
    clicks: number;
    ctr: number;
    cpc: number;
    result_type: MetricSummary["result_type"];
    results: number | null;
    cost_per_result: number | null;
  }>;
};

export type MetaAdsPlatformCampaign = {
  id: string;
  campaign_id: string | null;
  status: string;
  rascunho?: { name?: string } | null;
};

export type MetaAdsDashboardError = {
  ok: false;
  code:
    | "not_connected"
    | "account_not_selected"
    | "token_expired"
    | "permission"
    | "rate_limit"
    | "request_failed";
  message: string;
};

export type MetaAdsDashboardResult =
  | MetaAdsDashboardSuccess
  | MetaAdsDashboardError;

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resultMetrics(insight: MetaAdsInsight): Pick<
  MetricSummary,
  "result_type" | "results" | "cost_per_result"
> {
  const definitions = [
    {
      type: "onsite_conversion.messaging_conversation_started_7d",
      result_type: "conversation" as const,
    },
    { type: "lead", result_type: "lead" as const },
    { type: "purchase", result_type: "purchase" as const },
  ];
  for (const definition of definitions) {
    const results = metaAdsActionValue(insight.actions, definition.type);
    if (results === null) continue;
    const explicitCost = metaAdsActionValue(
      insight.cost_per_action_type,
      definition.type,
    );
    return {
      result_type: definition.result_type,
      results,
      cost_per_result: explicitCost ??
        (results > 0 ? number(insight.spend) / results : null),
    };
  }
  return { result_type: null, results: null, cost_per_result: null };
}

export function formatMetaAdsDashboardSummary(
  insight: MetaAdsInsight,
): MetricSummary {
  const result = resultMetrics(insight);
  return {
    spend: number(insight.spend),
    impressions: number(insight.impressions),
    reach: number(insight.reach),
    frequency: number(insight.frequency),
    clicks: number(insight.clicks),
    ctr: number(insight.ctr),
    cpc: number(insight.cpc),
    cpm: number(insight.cpm),
    conversations: metaAdsActionValue(
      insight.actions,
      "onsite_conversion.messaging_conversation_started_7d",
    ),
    leads: metaAdsActionValue(insight.actions, "lead"),
    purchases: metaAdsActionValue(insight.actions, "purchase"),
    roas: metaAdsActionValue(insight.purchase_roas, "omni_purchase") ??
      metaAdsActionValue(insight.purchase_roas, "purchase"),
    ...result,
  };
}

function graphError(response: Response, body: any): MetaAdsDashboardError {
  const code = Number(body?.error?.code || 0);
  if ([17, 613, 80004].includes(code) || response.status === 429) {
    return {
      ok: false,
      code: "rate_limit",
      message:
        "A Meta limitou as consultas agora. Aguarde alguns minutos e tente novamente.",
    };
  }
  if ([102, 190].includes(code) || response.status === 401) {
    return {
      ok: false,
      code: "token_expired",
      message: "A conexão do Meta Ads venceu. Reconecte em Configurações.",
    };
  }
  if (code === 200 || response.status === 403) {
    return {
      ok: false,
      code: "permission",
      message:
        "A conexão do Meta Ads está sem permissão para ler anúncios. Reconecte em Configurações.",
    };
  }
  return {
    ok: false,
    code: "request_failed",
    message: "Não foi possível consultar a Meta agora. Tente novamente.",
  };
}

export function clearMetaAdsDashboardCache(): void {
  cache.clear();
}

const emptySummary = (): MetricSummary => ({
  spend: 0,
  impressions: 0,
  reach: 0,
  frequency: 0,
  clicks: 0,
  ctr: 0,
  cpc: 0,
  cpm: 0,
  conversations: null,
  leads: null,
  purchases: null,
  roas: null,
  result_type: null,
  results: null,
  cost_per_result: null,
});

export function mergeMetaAdsDashboardCampaigns(input: {
  insights: MetaAdsInsight[];
  graphCampaigns: Array<{
    id?: unknown;
    name?: unknown;
    effective_status?: unknown;
  }>;
  platformCampaigns: MetaAdsPlatformCampaign[];
}): MetaAdsDashboardSuccess["campaigns"] {
  const insights = new Map(
    input.insights.map((row) => [String(row.campaign_id || ""), row]),
  );
  const platformByGraphId = new Map(
    input.platformCampaigns
      .filter((row) => row.campaign_id)
      .map((row) => [String(row.campaign_id), row]),
  );
  const graphById = new Map(
    input.graphCampaigns
      .filter((row) => row.id)
      .map((row) => [String(row.id), row]),
  );
  const graphIds = new Set([...graphById.keys(), ...insights.keys()].filter(Boolean));
  const rows: MetaAdsDashboardSuccess["campaigns"] = [...graphIds].map(
    (graphId) => {
      const graph = graphById.get(graphId);
      const insight = insights.get(graphId);
      const platform = platformByGraphId.get(graphId);
      return {
        id: graphId,
        graph_id: graphId,
        platform_id: platform?.id ?? null,
        source: platform ? "platform" : "meta",
        name: String(
          graph?.name || insight?.campaign_name ||
            platform?.rascunho?.name || "Campanha sem nome",
        ),
        status: platform?.status === "erro"
          ? "ERROR"
          : String(
            graph?.effective_status ||
              (platform?.status === "pausado"
                ? "PAUSED"
                : platform?.status === "expirado"
                ? "COMPLETED"
                : platform?.status === "publicado"
                ? "ACTIVE"
                : "UNKNOWN"),
          ),
        spend: number(insight?.spend),
        clicks: number(insight?.clicks),
        ctr: number(insight?.ctr),
        cpc: number(insight?.cpc),
        ...resultMetrics(insight ?? {}),
      };
    },
  );
  for (const platform of input.platformCampaigns) {
    if (platform.campaign_id && graphIds.has(String(platform.campaign_id))) {
      continue;
    }
    rows.push({
      id: `local:${platform.id}`,
      graph_id: platform.campaign_id ? String(platform.campaign_id) : null,
      platform_id: platform.id,
      source: "platform",
      name: String(platform.rascunho?.name || "Campanha da plataforma"),
      status: platform.status === "erro"
        ? "ERROR"
        : platform.status === "pausado"
        ? "PAUSED"
        : platform.status === "expirado"
        ? "COMPLETED"
        : platform.status === "publicado"
        ? "ACTIVE"
        : "UNKNOWN",
      spend: 0,
      clicks: 0,
      ctr: 0,
      cpc: 0,
      result_type: null,
      results: null,
      cost_per_result: null,
    });
  }
  return rows.sort((a, b) =>
    b.spend - a.spend || Number(b.source === "platform") -
      Number(a.source === "platform") || a.name.localeCompare(b.name)
  );
}

export async function getMetaAdsDashboard(input: {
  userId: string;
  period?: unknown;
  campaignId?: unknown;
  refresh?: unknown;
  loadIntegration: (
    userId: string,
  ) => Promise<MetaAdsIntegration | null>;
  loadPlatformCampaigns?: (
    userId: string,
  ) => Promise<MetaAdsPlatformCampaign[]>;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<MetaAdsDashboardResult> {
  const period = normalizeMetaAdsPeriod(input.period);
  const campaignId = String(input.campaignId ?? "").trim() || null;
  const now = input.now ?? Date.now();
  const integration = await input.loadIntegration(input.userId);
  if (!integration?.is_active || !integration.access_token) {
    return {
      ok: false,
      code: "not_connected",
      message: "Conecte o Meta Ads em Configurações para ver os relatórios.",
    };
  }
  const expiresAt = Date.parse(String(integration.token_expires_at ?? ""));
  if (Number.isFinite(expiresAt) && expiresAt <= now) {
    return {
      ok: false,
      code: "token_expired",
      message: "A conexão do Meta Ads venceu. Reconecte em Configurações.",
    };
  }
  if (!integration.ad_account_id) {
    return {
      ok: false,
      code: "account_not_selected",
      message: "Selecione uma conta de anúncios em Configurações.",
    };
  }

  const cacheKey =
    `${input.userId}:${integration.ad_account_id}:${period}:${campaignId ?? "all"}`;
  const cached = input.refresh === true ? undefined : cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return { ...cached.value, cached: true };
  }
  if (cached) cache.delete(cacheKey);

  const fetchImpl = input.fetchImpl ?? fetch;
  const graph = async (
    path: string,
    params: Record<string, string>,
  ): Promise<any> => {
    const url = new URL(`https://graph.facebook.com/v25.0/${path}`);
    Object.entries(params).forEach(([key, value]) =>
      url.searchParams.set(key, value)
    );
    url.searchParams.set("access_token", integration.access_token);
    const response = await fetchImpl(url);
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.error) throw graphError(response, body);
    return body;
  };

  try {
    const common = {
      date_preset: META_ADS_PERIODS[period].preset,
    };
    const [accountBody, platformCampaigns] = await Promise.all([
      graph(
      `${campaignId ?? integration.ad_account_id}/insights`,
      {
        ...common,
        ...(campaignId ? {} : { level: "account" }),
        fields: META_ADS_INSIGHT_FIELDS,
        limit: "1",
      },
      ),
      input.loadPlatformCampaigns?.(input.userId) ?? Promise.resolve([]),
    ]);
    const accountInsight = Array.isArray(accountBody?.data)
      ? accountBody.data[0] as MetaAdsInsight | undefined
      : undefined;

    const [dailyBody, campaignBody, statusesBody] = await Promise.all([
      graph(`${campaignId ?? integration.ad_account_id}/insights`, {
        ...common,
        ...(campaignId ? {} : { level: "account" }),
        fields: "date_start,date_stop,spend,clicks,actions",
        time_increment: "1",
        limit: "100",
      }),
      graph(`${integration.ad_account_id}/insights`, {
        ...common,
        level: "campaign",
        fields: `campaign_id,campaign_name,${META_ADS_INSIGHT_FIELDS}`,
        sort: "spend_descending",
        limit: "100",
      }),
      graph(`${integration.ad_account_id}/campaigns`, {
        fields: "id,name,effective_status",
        limit: "500",
      }),
    ]);

    const daily = (Array.isArray(dailyBody?.data) ? dailyBody.data : [])
      .map((row: MetaAdsInsight & { date_start?: string }) => ({
        date: String(row.date_start || ""),
        spend: number(row.spend),
        clicks: number(row.clicks),
        conversations: metaAdsActionValue(
          row.actions,
          "onsite_conversion.messaging_conversation_started_7d",
        ) ?? 0,
      }));
    const campaigns = mergeMetaAdsDashboardCampaigns({
      insights: Array.isArray(campaignBody?.data)
        ? campaignBody.data as MetaAdsInsight[]
        : [],
      graphCampaigns: Array.isArray(statusesBody?.data)
        ? statusesBody.data
        : [],
      platformCampaigns,
    });

    const result: MetaAdsDashboardSuccess = {
      ok: true,
      cached: false,
      period,
      account: {
        id: integration.ad_account_id,
        name: integration.ad_account_name ?? null,
        currency: integration.ad_account_currency || "BRL",
      },
      has_data: Boolean(accountInsight) || campaigns.length > 0,
      summary: accountInsight
        ? formatMetaAdsDashboardSummary(accountInsight)
        : campaignId || campaigns.length > 0
        ? emptySummary()
        : null,
      daily,
      campaigns,
    };
    cache.set(cacheKey, { value: result, expiresAt: now + CACHE_TTL_MS });
    return result;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "ok" in error &&
      (error as MetaAdsDashboardError).ok === false
    ) {
      return error as MetaAdsDashboardError;
    }
    return {
      ok: false,
      code: "request_failed",
      message: "Não foi possível consultar a Meta agora. Tente novamente.",
    };
  }
}
