import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  clearMetaAdsDashboardCache,
  formatMetaAdsDashboardSummary,
  getMetaAdsDashboard,
  metaAdsDashboardPeriodParams,
  mergeMetaAdsDashboardCampaigns,
} from "./meta-ads-dashboard.ts";

Deno.test("formata métricas do painel Meta Ads sem inventar resultados", () => {
  const summary = formatMetaAdsDashboardSummary({
    spend: "120.50",
    impressions: "10000",
    reach: "8000",
    frequency: "1.25",
    clicks: "200",
    ctr: "2",
    cpc: "0.6025",
    cpm: "12.05",
    actions: [{
      action_type: "onsite_conversion.messaging_conversation_started_7d",
      value: "15",
    }],
    cost_per_action_type: [{
      action_type: "onsite_conversion.messaging_conversation_started_7d",
      value: "8.033",
    }],
  });

  assertEquals(summary.spend, 120.5);
  assertEquals(summary.conversations, 15);
  assertEquals(summary.result_type, "conversation");
  assertEquals(summary.cost_per_result, 8.033);
  assertEquals(summary.leads, null);
});

Deno.test("painel retorna estrutura vazia quando não há anúncios", async () => {
  clearMetaAdsDashboardCache();
  const result = await getMetaAdsDashboard({
    userId: "tenant",
    period: "7_dias",
    loadIntegration: async () => ({
      access_token: "segredo",
      token_expires_at: "2026-11-01T00:00:00Z",
      ad_account_id: "act_empty",
      ad_account_name: "Conta sem anúncios",
      ad_account_currency: "BRL",
      is_active: true,
    }),
    now: Date.parse("2026-10-02T11:00:00Z"),
    fetchImpl: async () => Response.json({ data: [] }),
  });

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.has_data, false);
    assertEquals(result.summary, null);
    assertEquals(result.daily, []);
    assertEquals(result.campaigns, []);
  }
});

Deno.test("token vencido bloqueia consulta e orienta reconexão", async () => {
  let fetches = 0;
  const result = await getMetaAdsDashboard({
    userId: "tenant",
    period: "hoje",
    loadIntegration: async () => ({
      access_token: "segredo",
      token_expires_at: "2026-10-02T10:59:59Z",
      ad_account_id: "act_expired",
      is_active: true,
    }),
    now: Date.parse("2026-10-02T11:00:00Z"),
    fetchImpl: async () => {
      fetches++;
      return Response.json({});
    },
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.code, "token_expired");
    assertStringIncludes(result.message, "Reconecte");
  }
  assertEquals(fetches, 0);
});

Deno.test("mescla campanhas da plataforma sem gasto e campanhas externas", () => {
  const campaigns = mergeMetaAdsDashboardCampaigns({
    insights: [{
      campaign_id: "external-1",
      campaign_name: "Criada no Gerenciador",
      spend: "12.50",
      clicks: "4",
    }],
    graphCampaigns: [
      { id: "platform-1", name: "Campanha AMZ", effective_status: "PAUSED" },
      { id: "external-1", name: "Criada no Gerenciador", effective_status: "ACTIVE" },
    ],
    platformCampaigns: [{
      id: "local-1",
      campaign_id: "platform-1",
      status: "pausado",
      rascunho: { name: "Campanha AMZ" },
    }],
  });

  assertEquals(campaigns.length, 2);
  assertEquals(campaigns.find((row) => row.id === "platform-1"), {
    id: "platform-1",
    graph_id: "platform-1",
    platform_id: "local-1",
    source: "platform",
    name: "Campanha AMZ",
    status: "PAUSED",
    has_insights: false,
    spend: 0,
    clicks: 0,
    ctr: 0,
    cpc: 0,
    result_type: null,
    results: null,
    cost_per_result: null,
  });
  assertEquals(
    campaigns.find((row) => row.id === "external-1")?.source,
    "meta",
  );
});

Deno.test("campanha recém-publicada aparece em análise sem insights", async () => {
  clearMetaAdsDashboardCache();
  const now = Date.parse("2026-10-03T12:00:00Z");
  let observedPeriod: Record<string, unknown> | null = null;
  const result = await getMetaAdsDashboard({
    userId: "tenant",
    period: "7_dias",
    now,
    loadIntegration: async () => ({
      access_token: "segredo",
      token_expires_at: "2026-11-01T00:00:00Z",
      ad_account_id: "act_new",
      is_active: true,
    }),
    loadPlatformCampaigns: async () => [{
      id: "local-new",
      campaign_id: "campaign-new",
      ad_id: "ad-new",
      status: "publicado",
      rascunho: { name: "Campanha nova" },
    }],
    fetchImpl: async (url) => {
      const parsed = new URL(String(url));
      if (!observedPeriod && parsed.pathname.endsWith("/insights")) {
        observedPeriod = JSON.parse(
          parsed.searchParams.get("time_range") || "{}",
        );
      }
      if (parsed.pathname.endsWith("/campaigns")) {
        return Response.json({
          data: [{
            id: "campaign-new",
            name: "Campanha nova",
            effective_status: "ACTIVE",
          }],
        });
      }
      if (parsed.pathname.endsWith("/ad-new")) {
        return Response.json({
          id: "ad-new",
          effective_status: "PENDING_REVIEW",
        });
      }
      return Response.json({ data: [] });
    },
  });

  assertEquals(metaAdsDashboardPeriodParams("7_dias", now), {
    time_range: JSON.stringify({
      since: "2026-09-27",
      until: "2026-10-03",
    }),
  });
  assertEquals(observedPeriod, {
    since: "2026-09-27",
    until: "2026-10-03",
  });
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.has_data, true);
    assertEquals(result.summary?.spend, 0);
    assertEquals(result.campaigns, [{
      id: "campaign-new",
      graph_id: "campaign-new",
      platform_id: "local-new",
      source: "platform",
      name: "Campanha nova",
      status: "PENDING_REVIEW",
      has_insights: false,
      spend: 0,
      clicks: 0,
      ctr: 0,
      cpc: 0,
      result_type: null,
      results: null,
      cost_per_result: null,
    }]);
  }
});

Deno.test("painel reutiliza por 10 minutos apenas resposta de sucesso", async () => {
  clearMetaAdsDashboardCache();
  let fetches = 0;
  const run = () =>
    getMetaAdsDashboard({
      userId: "tenant",
      period: "ontem",
      loadIntegration: async () => ({
        access_token: "segredo",
        token_expires_at: "2026-11-01T00:00:00Z",
        ad_account_id: "act_cached_dashboard",
        is_active: true,
      }),
      now: Date.parse("2026-10-02T11:00:00Z"),
      fetchImpl: async (url) => {
        fetches++;
        const parsed = new URL(String(url));
        if (parsed.pathname.endsWith("/campaigns")) {
          return Response.json({ data: [] });
        }
        if (parsed.searchParams.get("time_increment") === "1") {
          return Response.json({ data: [] });
        }
        if (parsed.searchParams.get("level") === "campaign") {
          return Response.json({ data: [] });
        }
        return Response.json({ data: [{ spend: "1", clicks: "1" }] });
      },
    });

  const first = await run();
  const second = await run();
  assertEquals(first.ok, true);
  assertEquals(second.ok && second.cached, true);
  assertEquals(fetches, 4);
});
