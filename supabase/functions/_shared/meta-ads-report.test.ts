import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  clearMetaAdsReportCache,
  formatMetaAdsReport,
  getMetaAdsReport,
  isMetaAdsReportRequest,
} from "./meta-ads-report.ts";

Deno.test("formata relatório Meta Ads com métricas e campanhas", () => {
  const report = formatMetaAdsReport({
    period: "7_dias",
    accountName: "Conta Principal",
    account: {
      spend: "123.45",
      impressions: "10000",
      reach: "8000",
      frequency: "1.25",
      clicks: "250",
      ctr: "2.5",
      cpc: "0.49",
      cpm: "12.34",
      actions: [{ action_type: "lead", value: "10" }],
      cost_per_action_type: [{ action_type: "lead", value: "12.345" }],
    },
    campaigns: [{
      campaign_name: "Captação",
      spend: "100",
      ctr: "3.1",
    }],
  });

  assertStringIncludes(report, "R$ 123,45");
  assertStringIncludes(report, "Leads: 10");
  assertStringIncludes(report, "Captação — R$ 100,00");
});

Deno.test("relatório sem dados não inventa métricas", () => {
  assertEquals(
    formatMetaAdsReport({ period: "ontem", account: null }),
    "📊 Meta Ads — ontem\n\nNão houve dados de anúncios nesse período.",
  );
});

Deno.test("reconhece pedidos de relatório e rejeita frase sem intenção", () => {
  assertEquals(isMetaAdsReportRequest("como estão meus anúncios?"), true);
  assertEquals(isMetaAdsReportRequest("quanto gastei em anúncios"), true);
  assertEquals(isMetaAdsReportRequest("crie um anúncio novo"), false);
});

Deno.test("token vencido orienta reconexão sem chamar a Meta", async () => {
  let fetches = 0;
  const report = await getMetaAdsReport({
    userId: "tenant",
    period: "hoje",
    now: Date.parse("2026-10-02T10:00:00Z"),
    loadIntegration: async () => ({
      access_token: "segredo",
      token_expires_at: "2026-10-02T09:59:59Z",
      ad_account_id: "act_1",
      is_active: true,
    }),
    fetchImpl: async () => {
      fetches++;
      return new Response();
    },
  });
  assertStringIncludes(report, "venceu");
  assertEquals(fetches, 0);
});

Deno.test("cache de 10 minutos evita repetir chamadas", async () => {
  clearMetaAdsReportCache();
  let fetches = 0;
  const run = () =>
    getMetaAdsReport({
      userId: "tenant",
      period: "7 dias",
      now: Date.parse("2026-10-02T10:00:00Z"),
      loadIntegration: async () => ({
        access_token: "segredo",
        token_expires_at: "2026-11-02T10:00:00Z",
        ad_account_id: "act_cache",
        ad_account_name: "Conta",
        is_active: true,
      }),
      fetchImpl: async (url) => {
        fetches++;
        const level = new URL(String(url)).searchParams.get("level");
        return Response.json({
          data: level === "account"
            ? [{
              spend: "10",
              impressions: "100",
              reach: "80",
              clicks: "5",
            }]
            : [],
        });
      },
    });

  const first = await run();
  const second = await run();
  assertEquals(second, first);
  assertEquals(fetches, 2);
});
