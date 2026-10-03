import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  applyMetaAdsMediaToCreative,
  buildMetaAdsPayloads,
  calculateMetaAdsMonthlyAvailability,
  checkMetaAdsMonthlyCap,
  checkMetaAdsReactivationAvailability,
  hasCompleteMetaAdsEntityIds,
  hasExplicitMetaAdsPublishConfirmation,
  isMetaAdsCampaignEnded,
  type MetaAdsDraft,
  metaAdsMaximumSpend,
  metaGraphRequest,
  publishMetaAdsCampaign,
  publicMetaAdsError,
  uploadMetaAdsMedia,
  validateMetaAdsDraft,
} from "./meta-ads-create.ts";

const draft: MetaAdsDraft = {
  name: "Campanha segura",
  objective: "whatsapp",
  primary_text: "Fale conosco",
  headline: "Atendimento no WhatsApp",
  media_url: "https://cdn.example.test/anuncio.png",
  media_type: "image",
  media_id: "9ee8620e-6e3d-4dbc-8297-423bd45a1886",
  media_source: "midias_whatsapp",
  daily_budget: 20,
  duration_days: 5,
  cities: [{ id: "2420605", name: "São Paulo" }],
  interests: [{ id: "6003139266461", name: "Marketing" }],
  behaviors: [{ id: "6002714895372", name: "Compradores envolvidos" }],
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
  assertEquals(valid.draft.media_source, "midias_whatsapp");
  assertEquals(valid.draft.media_id, draft.media_id);
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

Deno.test("bloqueia publicação sem confirmação explícita", () => {
  assertEquals(hasExplicitMetaAdsPublishConfirmation({}), false);
  assertEquals(
    hasExplicitMetaAdsPublishConfirmation({ confirmed: "true" }),
    false,
  );
  assertEquals(
    hasExplicitMetaAdsPublishConfirmation({ confirm_publish: true }),
    true,
  );
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
      inFlightReservations: [40],
      daysRemaining: 10,
    }),
    {
      cap: 500,
      spent: 120,
      activeReservedRemaining: 120,
      inFlightReserved: 40,
      reservedRemaining: 160,
      available: 220,
      suggestedDaily: 22,
    },
  );
});

Deno.test("reativação usa somente o gasto máximo ainda não consumido", () => {
  assertEquals(
    checkMetaAdsReactivationAvailability({
      maximumSpend: 300,
      lifetimeSpent: 180,
      available: 120,
    }),
    { ok: true, requested: 120, available: 120 },
  );
  assertEquals(
    checkMetaAdsReactivationAvailability({
      maximumSpend: 300,
      lifetimeSpent: 180,
      available: 119.99,
    }),
    { ok: false, requested: 120, available: 119.99 },
  );
});

Deno.test("não permite reativar campanha cuja data de término passou", () => {
  const now = Date.parse("2026-10-03T00:00:00Z");
  assertEquals(isMetaAdsCampaignEnded({
    approvedAt: "2026-09-01T00:00:00Z",
    durationDays: 14,
    now,
  }), true);
  assertEquals(isMetaAdsCampaignEnded({
    approvedAt: "2026-10-01T00:00:00Z",
    durationDays: 14,
    now,
  }), false);
});

Deno.test("exige os quatro IDs Graph antes de concluir publicação", () => {
  assertEquals(
    hasCompleteMetaAdsEntityIds({
      campaign_id: "c1",
      adset_id: "s1",
      creative_id: "cr1",
      ad_id: "a1",
    }),
    true,
  );
  assertEquals(
    hasCompleteMetaAdsEntityIds({
      campaign_id: "c1",
      adset_id: "s1",
      creative_id: "",
      ad_id: "a1",
    }),
    false,
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
  assertEquals("degrees_of_freedom_spec" in payloads.creative, false);
  const serializedCreative = JSON.stringify(payloads.creative);
  assertEquals(serializedCreative.includes('"multi_advertiser_ads"'), false);
  assertEquals(serializedCreative.includes('"standard_enhancements"'), false);
  assertEquals(
    payloads.creative.contextual_multi_ads,
    { enroll_status: "OPT_OUT" },
  );
  assertEquals(payloads.adset.bid_strategy, "LOWEST_COST_WITHOUT_CAP");
  assertEquals(payloads.adset.targeting.age_min, 18);
  assertEquals(payloads.adset.targeting.age_max, 65);
  assertEquals(payloads.adset.targeting.behaviors, [
    { id: "6002714895372", name: "Compradores envolvidos" },
  ]);
  assertEquals(payloads.adset.targeting_automation.advantage_audience, 0);
  assertEquals(
    payloads.adset.promoted_object?.whatsapp_phone_number,
    "5511999999999",
  );
  assertEquals(
    payloads.creative.object_story_spec.link_data?.link,
    "https://api.whatsapp.com/send",
  );
  assertEquals(
    payloads.creative.object_story_spec.link_data?.call_to_action,
    {
      type: "WHATSAPP_MESSAGE",
      value: { app_destination: "WHATSAPP" },
    },
  );
});

Deno.test("só envia spend_cap para campanhas de pelo menos R$ 600", () => {
  const context = {
    accessToken: "secret",
    adAccountId: "act_1",
    pageId: "page_1",
    whatsappPhoneNumber: "+55 11 99999-9999",
  };
  const small = buildMetaAdsPayloads({
    ...context,
    draft: { ...draft, daily_budget: 10, duration_days: 14 },
  });
  assertEquals("spend_cap" in small.campaign, false);

  const large = buildMetaAdsPayloads({
    ...context,
    draft: { ...draft, daily_budget: 100, duration_days: 9 },
  });
  assertEquals(large.campaign.spend_cap, 90_000);
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

Deno.test("vídeo espera ficar pronto e sempre recebe uma capa", async () => {
  let statusChecks = 0;
  let sleeps = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/advideos") && init?.method === "POST") {
      return Response.json({ id: "video_1" });
    }
    if (url.pathname.endsWith("/video_1")) {
      statusChecks++;
      return Response.json({
        status: {
          video_status: statusChecks === 1 ? "processing" : "ready",
        },
      });
    }
    if (url.pathname.endsWith("/video_1/thumbnails")) {
      return Response.json({
        data: [
          { uri: "https://cdn.example.test/other.jpg" },
          {
            uri: "https://cdn.example.test/preferred.jpg",
            is_preferred: true,
          },
        ],
      });
    }
    throw new Error(`unexpected request: ${url.pathname}`);
  };
  const videoDraft: MetaAdsDraft = {
    ...draft,
    media_type: "video",
    media_url: "https://cdn.example.test/anuncio.mp4",
  };
  const context = {
    accessToken: "secret",
    adAccountId: "act_1",
    pageId: "page_1",
    whatsappPhoneNumber: "5511999999999",
    draft: videoDraft,
  };
  const media = await uploadMetaAdsMedia(context, fetchImpl, {
    pollIntervalMs: 3_000,
    timeoutMs: 90_000,
    sleepImpl: () => {
      sleeps++;
      return Promise.resolve();
    },
  });
  assertEquals(statusChecks, 2);
  assertEquals(sleeps, 1);
  assertEquals(media, {
    videoId: "video_1",
    videoThumbnailUrl: "https://cdn.example.test/preferred.jpg",
  });

  const creative = structuredClone(buildMetaAdsPayloads(context).creative);
  applyMetaAdsMediaToCreative(creative, "video", media);
  assertEquals(creative.object_story_spec.video_data?.video_id, "video_1");
  const videoData = creative.object_story_spec.video_data as Record<
    string,
    unknown
  >;
  assert(
    Boolean(videoData.image_url || videoData.image_hash),
    "payload de vídeo precisa ter image_url ou image_hash",
  );
  assertEquals(
    videoData.image_url,
    "https://cdn.example.test/preferred.jpg",
  );
});

Deno.test("vídeo usa thumbnail da plataforma como image_hash se a Meta não gerar capa", async () => {
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "thumb.example.test") {
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/jpeg" },
      });
    }
    if (url.pathname.endsWith("/advideos") && init?.method === "POST") {
      return Response.json({ id: "video_2" });
    }
    if (url.pathname.endsWith("/video_2")) {
      return Response.json({ status: { video_status: "ready" } });
    }
    if (url.pathname.endsWith("/video_2/thumbnails")) {
      return Response.json({ data: [] });
    }
    if (url.pathname.endsWith("/adimages")) {
      return Response.json({ images: { creative: { hash: "cover_hash" } } });
    }
    throw new Error(`unexpected request: ${url.pathname}`);
  };
  const videoDraft: MetaAdsDraft = {
    ...draft,
    media_type: "video",
    media_url: "https://cdn.example.test/anuncio.mp4",
    thumbnail_url: "https://thumb.example.test/capa.jpg",
  };
  const context = {
    accessToken: "secret",
    adAccountId: "act_1",
    pageId: "page_1",
    draft: videoDraft,
  };
  const media = await uploadMetaAdsMedia(context, fetchImpl);
  assertEquals(media, { videoId: "video_2", imageHash: "cover_hash" });
  const creative = structuredClone(buildMetaAdsPayloads(context).creative);
  applyMetaAdsMediaToCreative(creative, "video", media);
  const videoData = creative.object_story_spec.video_data as Record<
    string,
    unknown
  >;
  assertEquals(videoData.image_hash, "cover_hash");
  assertEquals(Boolean(videoData.image_url), false);
});

Deno.test("erro detalhado da Meta chega sanitizado ao front", async () => {
  let caught: unknown;
  try {
    await metaGraphRequest("act_1/generatepreviews", {
      accessToken: "secret-token",
      method: "GET",
      stage: "generatepreviews",
      fetchImpl: () =>
        Promise.resolve(Response.json({
          error: {
            code: 100,
            error_subcode: 1815010,
            error_user_title: "Vídeo indisponível",
            error_user_msg:
              "Aguarde o processamento em https://example.test/video?token=segredo",
            message: "Falhou access_token=secret-token",
          },
        }, { status: 400 })),
    });
  } catch (error) {
    caught = error;
  }
  assert(caught);
  const safe = publicMetaAdsError(caught);
  assertEquals(safe.code, "meta_request_failed");
  assert(safe.message.includes("Vídeo indisponível"));
  assert(safe.message.includes("Aguarde o processamento"));
  assertEquals(safe.message.includes("secret-token"), false);
  assertEquals(safe.message.includes("https://"), false);
});

Deno.test("generatepreviews usa GET com creative serializado na query", async () => {
  let requestUrl = "";
  let requestMethod = "";
  const creative = {
    object_story_spec: {
      page_id: "page_1",
      video_data: { video_id: "video_1", image_url: "https://example.test/capa.jpg" },
    },
  };
  await metaGraphRequest("act_1/generatepreviews", {
    accessToken: "secret",
    method: "GET",
    params: {
      creative,
      ad_format: "MOBILE_FEED_STANDARD",
    },
    fetchImpl: (input, init) => {
      requestUrl = String(input);
      requestMethod = init?.method ?? "";
      return Promise.resolve(Response.json({ data: [{ body: "<iframe />" }] }));
    },
  });
  const parsedUrl = new URL(requestUrl);
  assertEquals(requestMethod, "GET");
  assertEquals(
    parsedUrl.searchParams.get("creative"),
    JSON.stringify(creative),
  );
  assertEquals(
    parsedUrl.searchParams.get("ad_format"),
    "MOBILE_FEED_STANDARD",
  );
  assertEquals(parsedUrl.searchParams.has("access_token"), false);
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
