import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildMetaAdsPayloads,
  calculateMetaAdsMonthlyAvailability,
  checkMetaAdsMonthlyCap,
  generateMetaAdsCopy,
  type MetaAdsDraft,
  metaAdsMaximumSpend,
  publishMetaAdsCampaign,
  validateMetaAdsDraft,
} from "./meta-ads-create.ts";

const draft: MetaAdsDraft = {
  name: "Campanha segura",
  objective: "whatsapp",
  primary_text: "Fale conosco",
  headline: "Atendimento no WhatsApp",
  media_url: "https://cdn.example.test/anuncio.png",
  media_type: "image",
  daily_budget: 20,
  duration_days: 5,
  cities: [{ id: "2420605", name: "São Paulo" }],
  interests: [{ id: "6003139266461", name: "Marketing" }],
  radius_km: 25,
  age_min: 18,
  age_max: 65,
  whatsapp_message: "Olá, quero saber mais",
  special_ad_categories: [],
};

Deno.test("valida e normaliza rascunho sem aceitar mídia insegura", () => {
  const valid = validateMetaAdsDraft(draft);
  assert(valid.ok);
  assertEquals(valid.draft.daily_budget, 20);
  assertEquals(metaAdsMaximumSpend(valid.draft), 100);

  const invalid = validateMetaAdsDraft({
    ...draft,
    media_url: "http://example.test/inseguro.png",
    duration_days: 0,
    cities: [],
  });
  assertEquals(invalid.ok, false);
  if (!invalid.ok) {
    assert(invalid.errors.includes("media_url"));
    assert(invalid.errors.includes("duration_days"));
    assert(invalid.errors.includes("cities"));
  }
  const legacy = validateMetaAdsDraft({
    name: draft.name,
    primary_text: draft.primary_text,
    headline: draft.headline,
    media_url: draft.media_url,
    media_type: draft.media_type,
    daily_budget: draft.daily_budget,
    duration_days: draft.duration_days,
    cities: draft.cities,
  });
  assert(legacy.ok);
  assertEquals(legacy.draft.objective, "whatsapp");
  assertEquals(legacy.draft.radius_km, 25);
  assertEquals(legacy.draft.age_min, 18);
  assertEquals(legacy.draft.age_max, 65);
  assertEquals(legacy.draft.special_ad_categories, []);

  const invalidTargeting = validateMetaAdsDraft({
    ...draft,
    objective: "unknown",
    radius_km: 100,
    age_min: 17,
    gender: "unknown",
    special_ad_categories: ["NOT_A_CATEGORY"],
  });
  assert(!invalidTargeting.ok);
  assert(invalidTargeting.errors.includes("objective"));
  assert(invalidTargeting.errors.includes("radius_km"));
  assert(invalidTargeting.errors.includes("age_range"));
  assert(invalidTargeting.errors.includes("gender"));
  assert(invalidTargeting.errors.includes("special_ad_categories"));
});

Deno.test("impõe teto mensal incluindo o gasto máximo solicitado", () => {
  assertEquals(
    checkMetaAdsMonthlyCap({
      monthlyCap: 200,
      alreadyCommitted: 80,
      newMaximumSpend: 100,
    }),
    { ok: true, remaining: 20 },
  );
  assertEquals(
    checkMetaAdsMonthlyCap({
      monthlyCap: 200,
      alreadyCommitted: 150,
      newMaximumSpend: 100,
    }),
    {
      ok: false,
      code: "monthly_cap_exceeded",
      cap: 200,
      committed: 150,
      requested: 100,
    },
  );
});

Deno.test("calcula teto com gasto real e saldo apenas de campanhas ativas", () => {
  assertEquals(
    calculateMetaAdsMonthlyAvailability({
      monthlyCap: 500,
      actualSpent: 120,
      activeCampaigns: [
        { maximumSpend: 200, lifetimeSpent: 80 },
        { maximumSpend: 100, lifetimeSpent: 130 },
      ],
      daysRemaining: 10,
    }),
    {
      cap: 500,
      spent: 120,
      reservedRemaining: 120,
      available: 260,
      suggestedDaily: 26,
    },
  );
});

Deno.test("payload usa padrões fixos, pausados e desliga expansões", () => {
  const payloads = buildMetaAdsPayloads({
    accessToken: "secret",
    adAccountId: "act_1",
    pageId: "page_1",
    whatsappPhoneNumber: "+55 11 99999-9999",
    draft,
  });
  assertEquals(payloads.campaign.status, "PAUSED");
  assertEquals(payloads.adset.status, "PAUSED");
  assertEquals(payloads.ad.status, "PAUSED");
  assertEquals(
    payloads.creative.degrees_of_freedom_spec.creative_features_spec
      .standard_enhancements.enroll_status,
    "OPT_OUT",
  );
  assertEquals(
    payloads.creative.degrees_of_freedom_spec.creative_features_spec
      .multi_advertiser_ads.enroll_status,
    "OPT_OUT",
  );
  assertEquals(payloads.adset.bid_strategy, "LOWEST_COST_WITHOUT_CAP");
  assertEquals(payloads.adset.targeting.age_min, 18);
  assertEquals(payloads.adset.targeting.age_max, 65);
  assertEquals(payloads.adset.targeting_automation.advantage_audience, 0);
  assert(
    payloads.creative.object_story_spec.link_data?.call_to_action.value.link
      .includes("text=Ol%C3%A1"),
  );
});

Deno.test("site usa tráfego, link clicks e destino HTTPS sem WhatsApp", () => {
  const validated = validateMetaAdsDraft({
    ...draft,
    objective: "site",
    destination_url: "https://example.com/oferta",
    gender: "female",
    special_ad_categories: ["CREDIT"],
  });
  assert(validated.ok);
  const payloads = buildMetaAdsPayloads({
    accessToken: "secret",
    adAccountId: "act_1",
    pageId: "page_1",
    draft: validated.draft,
  });
  assertEquals(payloads.campaign.objective, "OUTCOME_TRAFFIC");
  assertEquals(payloads.campaign.special_ad_categories, ["CREDIT"]);
  assertEquals(payloads.campaign.special_ad_category_country, ["BR"]);
  assertEquals(payloads.adset.destination_type, "WEBSITE");
  assertEquals(payloads.adset.optimization_goal, "LINK_CLICKS");
  assertEquals(payloads.adset.targeting.genders, [2]);
  assertEquals(
    payloads.creative.object_story_spec.link_data?.link,
    "https://example.com/oferta",
  );
});

Deno.test("geração de copy usa JSON editável e recua para texto fornecido", async () => {
  const generated = await generateMetaAdsCopy({
    apiKey: "server-secret",
    draft,
    fetchImpl: async (_input, init) => {
      assertEquals(
        (init?.headers as Record<string, string>).Authorization,
        "Bearer server-secret",
      );
      return Response.json({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: JSON.stringify({
                  primary_text: "Texto criado",
                  headline: "Título criado",
                }),
              },
            }],
          },
        }],
      });
    },
  });
  assertEquals(generated, {
    primary_text: "Texto criado",
    headline: "Título criado",
    generated: true,
  });
  assertEquals(
    await generateMetaAdsCopy({
      draft,
      apiKey: "server-secret",
      fetchImpl: async () => new Response("indisponível", { status: 503 }),
    }),
    {
      primary_text: draft.primary_text,
      headline: draft.headline,
      generated: false,
    },
  );
});

Deno.test("publica em ordem e só ativa após criar o anúncio", async () => {
  const calls: Array<{ path: string; method: string; status?: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "cdn.example.test") {
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/png" },
      });
    }
    const form = init?.body instanceof URLSearchParams ? init.body : null;
    calls.push({
      path: url.pathname,
      method: init?.method ?? "GET",
      status: form?.get("status") ?? undefined,
    });
    if (url.pathname.endsWith("/adimages")) {
      return Response.json({ images: { creative: { hash: "hash_1" } } });
    }
    if (url.pathname.endsWith("/campaigns")) return Response.json({ id: "c1" });
    if (url.pathname.endsWith("/adsets")) return Response.json({ id: "s1" });
    if (url.pathname.endsWith("/adcreatives")) {
      return Response.json({ id: "cr1" });
    }
    if (url.pathname.endsWith("/ads")) return Response.json({ id: "a1" });
    return Response.json({ success: true });
  };

  const result = await publishMetaAdsCampaign({
    accessToken: "secret",
    adAccountId: "act_1",
    pageId: "page_1",
    whatsappPhoneNumber: "5511999999999",
    draft,
  }, { fetchImpl });

  assertEquals(result, {
    campaign_id: "c1",
    adset_id: "s1",
    creative_id: "cr1",
    ad_id: "a1",
  });
  assertEquals(
    calls.map((call) => `${call.path}:${call.status ?? "create"}`),
    [
      "/v25.0/act_1/adimages:create",
      "/v25.0/act_1/campaigns:PAUSED",
      "/v25.0/act_1/adsets:PAUSED",
      "/v25.0/act_1/adcreatives:create",
      "/v25.0/act_1/ads:PAUSED",
      "/v25.0/a1:ACTIVE",
      "/v25.0/s1:ACTIVE",
      "/v25.0/c1:ACTIVE",
    ],
  );
});

Deno.test("remove entidades Graph em ordem reversa quando publicação falha", async () => {
  const deleted: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "cdn.example.test") {
      return new Response(new Uint8Array([1]), {
        headers: { "content-type": "image/png" },
      });
    }
    if (init?.method === "DELETE") {
      deleted.push(url.pathname);
      return Response.json({ success: true });
    }
    if (url.pathname.endsWith("/adimages")) {
      return Response.json({ images: { creative: { hash: "hash_1" } } });
    }
    if (url.pathname.endsWith("/campaigns")) return Response.json({ id: "c1" });
    if (url.pathname.endsWith("/adsets")) return Response.json({ id: "s1" });
    return Response.json({
      error: { code: 100, message: "criativo inválido" },
    }, { status: 400 });
  };

  let failed = false;
  try {
    await publishMetaAdsCampaign({
      accessToken: "secret",
      adAccountId: "act_1",
      pageId: "page_1",
      whatsappPhoneNumber: "5511999999999",
      draft,
    }, { fetchImpl });
  } catch {
    failed = true;
  }
  assert(failed);
  assertEquals(deleted, [
    "/v25.0/s1",
    "/v25.0/c1",
    "/v25.0/act_1/adimages",
  ]);
});
