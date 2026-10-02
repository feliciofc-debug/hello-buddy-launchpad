export const META_GRAPH_VERSION = "v25.0";
export const META_GRAPH_URL =
  `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export type MetaAdsTarget = {
  id: string;
  name: string;
};

export type MetaAdsDraft = {
  name: string;
  objective?: "whatsapp" | "site";
  primary_text: string;
  headline: string;
  description?: string;
  media_url: string;
  media_type: "image" | "video";
  media_id?: string;
  media_source?:
    | "midias_whatsapp"
    | "video_render_jobs"
    | "video_motion_jobs";
  media_bucket?: string;
  media_path?: string;
  daily_budget: number;
  duration_days: number;
  cities: MetaAdsTarget[];
  interests?: MetaAdsTarget[];
  behaviors?: MetaAdsTarget[];
  destination_url?: string;
  radius_km?: number;
  age_min?: number;
  age_max?: number;
  gender?: "male" | "female";
  whatsapp_message?: string;
  special_ad_categories?: MetaAdsSpecialCategory[];
};

export type MetaAdsSpecialCategory =
  | "CREDIT"
  | "EMPLOYMENT"
  | "HOUSING"
  | "ISSUES_ELECTIONS_POLITICS"
  | "FINANCIAL_PRODUCTS_SERVICES";

export type MetaAdsPublishContext = {
  accessToken: string;
  adAccountId: string;
  pageId: string;
  whatsappPhoneNumber?: string;
  draft: MetaAdsDraft;
};

export type MetaAdsEntityIds = {
  campaign_id: string;
  adset_id: string;
  creative_id: string;
  ad_id: string;
};

export function hasCompleteMetaAdsEntityIds(
  value: Partial<MetaAdsEntityIds> | null | undefined,
): boolean {
  return Boolean(
    value &&
      String(value.campaign_id ?? "").trim() &&
      String(value.adset_id ?? "").trim() &&
      String(value.creative_id ?? "").trim() &&
      String(value.ad_id ?? "").trim(),
  );
}

export type MetaGraphError = Error & {
  graphCode?: number;
  graphSubcode?: number;
  status?: number;
};

const MAX_DAILY_BUDGET = 1_000_000;
const MAX_TEXT = 2_000;
const NAME_MAX = 120;
const SPECIAL_CATEGORIES = new Set<MetaAdsSpecialCategory>([
  "CREDIT",
  "EMPLOYMENT",
  "HOUSING",
  "ISSUES_ELECTIONS_POLITICS",
  "FINANCIAL_PRODUCTS_SERVICES",
]);

function cleanText(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function finiteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function validHttpsUrl(value: unknown): string {
  const text = String(value ?? "").trim();
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function targets(value: unknown, maximum: number): MetaAdsTarget[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: MetaAdsTarget[] = [];
  for (const item of value) {
    const id = cleanText(item?.id ?? item?.key, 100);
    const name = cleanText(item?.name, 160);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    result.push({ id, name });
    if (result.length >= maximum) break;
  }
  return result;
}

function specialCategories(value: unknown): MetaAdsSpecialCategory[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).toUpperCase()))]
    .filter((item): item is MetaAdsSpecialCategory =>
      SPECIAL_CATEGORIES.has(item as MetaAdsSpecialCategory)
    );
}

export function validateMetaAdsDraft(
  value: unknown,
): { ok: true; draft: MetaAdsDraft } | {
  ok: false;
  code: "invalid_draft";
  errors: string[];
} {
  const input = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const dailyBudget = finiteNumber(input.daily_budget);
  const durationDays = finiteNumber(input.duration_days);
  const radius = input.radius_km === undefined
    ? 25
    : finiteNumber(input.radius_km);
  const ageMin = input.age_min === undefined ? 18 : finiteNumber(input.age_min);
  const ageMax = input.age_max === undefined ? 65 : finiteNumber(input.age_max);
  const objective = input.objective === "site" ? "site" : "whatsapp";
  const gender = input.gender === "male" || input.gender === "female"
    ? input.gender
    : undefined;
  const mediaType = input.media_type === "video"
    ? "video"
    : input.media_type === "image"
    ? "image"
    : "";
  const draft: MetaAdsDraft = {
    name: cleanText(input.name, NAME_MAX),
    objective,
    primary_text: cleanText(input.primary_text, MAX_TEXT),
    headline: cleanText(input.headline, 255),
    description: cleanText(input.description, 255) || undefined,
    media_url: validHttpsUrl(input.media_url),
    media_type: mediaType as "image" | "video",
    media_id: cleanText(input.media_id, 100) || undefined,
    media_source: [
        "midias_whatsapp",
        "video_render_jobs",
        "video_motion_jobs",
      ].includes(String(input.media_source))
      ? input.media_source as MetaAdsDraft["media_source"]
      : undefined,
    media_bucket: cleanText(input.media_bucket, 100) || undefined,
    media_path: cleanText(input.media_path, 1_000) || undefined,
    daily_budget: dailyBudget,
    duration_days: durationDays,
    cities: targets(input.cities, 25),
    interests: targets(input.interests, 50),
    behaviors: targets(input.behaviors, 50),
    destination_url: validHttpsUrl(input.destination_url) || undefined,
    radius_km: radius,
    age_min: ageMin,
    age_max: ageMax,
    gender,
    whatsapp_message: cleanText(input.whatsapp_message, 1_000) || undefined,
    special_ad_categories: specialCategories(input.special_ad_categories),
  };
  const errors: string[] = [];
  if (!draft.name) errors.push("name");
  if (
    input.objective !== undefined && input.objective !== "" &&
    !["whatsapp", "site"].includes(String(input.objective))
  ) errors.push("objective");
  if (!draft.primary_text) errors.push("primary_text");
  if (!draft.headline) errors.push("headline");
  if (!draft.media_url) errors.push("media_url");
  if (!mediaType) errors.push("media_type");
  if (draft.media_source && !draft.media_id) errors.push("media_id");
  if (
    !Number.isFinite(dailyBudget) || dailyBudget < 1 ||
    dailyBudget > MAX_DAILY_BUDGET
  ) errors.push("daily_budget");
  if (
    !Number.isInteger(durationDays) || durationDays < 1 ||
    durationDays > 365
  ) errors.push("duration_days");
  if (!draft.cities.length) errors.push("cities");
  if (!Number.isFinite(radius) || radius < 1 || radius > 80) {
    errors.push("radius_km");
  }
  if (
    !Number.isInteger(ageMin) || !Number.isInteger(ageMax) || ageMin < 18 ||
    ageMax > 65 || ageMin > ageMax
  ) errors.push("age_range");
  if (
    input.gender !== undefined && input.gender !== null &&
    input.gender !== "" && input.gender !== "all" && !gender
  ) errors.push("gender");
  if (objective === "site" && !draft.destination_url) {
    errors.push("destination_url");
  }
  if (
    input.special_ad_categories !== undefined &&
    (!Array.isArray(input.special_ad_categories) ||
      specialCategories(input.special_ad_categories).length !==
        new Set(
          (input.special_ad_categories as unknown[]).map((item) =>
            String(item).toUpperCase()
          ),
        ).size)
  ) errors.push("special_ad_categories");
  return errors.length ? { ok: false, code: "invalid_draft", errors } : {
    ok: true,
    draft,
  };
}

export function metaAdsMaximumSpend(draft: MetaAdsDraft): number {
  return Math.round(draft.daily_budget * draft.duration_days * 100) / 100;
}

export function hasExplicitMetaAdsPublishConfirmation(
  value: unknown,
): boolean {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return input.confirm_publish === true ||
    input.confirmed === true ||
    input.confirm === true;
}

export function checkMetaAdsMonthlyCap(input: {
  monthlyCap: unknown;
  alreadyCommitted: unknown;
  newMaximumSpend: unknown;
}): { ok: true; remaining: number } | {
  ok: false;
  code: "monthly_cap_exceeded";
  cap: number;
  committed: number;
  requested: number;
} {
  const cap = finiteNumber(input.monthlyCap);
  const committed = Math.max(0, finiteNumber(input.alreadyCommitted) || 0);
  const requested = Math.max(0, finiteNumber(input.newMaximumSpend) || 0);
  if (!Number.isFinite(cap) || cap < 0 || committed + requested > cap) {
    return {
      ok: false,
      code: "monthly_cap_exceeded",
      cap: Number.isFinite(cap) ? cap : 0,
      committed,
      requested,
    };
  }
  return {
    ok: true,
    remaining: Math.round((cap - committed - requested) * 100) / 100,
  };
}

export function calculateMetaAdsMonthlyAvailability(input: {
  monthlyCap: unknown;
  actualSpent: unknown;
  activeCampaigns: Array<{
    maximumSpend: unknown;
    lifetimeSpent: unknown;
  }>;
  inFlightReservations?: unknown[];
  daysRemaining?: number;
}): {
  cap: number;
  spent: number;
  activeReservedRemaining: number;
  inFlightReserved: number;
  reservedRemaining: number;
  available: number;
  suggestedDaily: number;
} {
  const cap = Math.max(0, finiteNumber(input.monthlyCap) || 0);
  const spent = Math.max(0, finiteNumber(input.actualSpent) || 0);
  const activeReservedRemaining = input.activeCampaigns.reduce(
    (total, campaign) => {
      const maximum = Math.max(0, finiteNumber(campaign.maximumSpend) || 0);
      const lifetime = Math.max(0, finiteNumber(campaign.lifetimeSpent) || 0);
      return total + Math.max(0, maximum - lifetime);
    },
    0,
  );
  const inFlightReserved = (input.inFlightReservations ?? []).reduce(
    (total: number, reservation) =>
      total + Math.max(0, finiteNumber(reservation) || 0),
    0,
  );
  const reservedRemaining = activeReservedRemaining + inFlightReserved;
  const available = Math.max(
    0,
    Math.round((cap - spent - reservedRemaining) * 100) / 100,
  );
  const daysRemaining = Math.max(
    1,
    Math.floor(finiteNumber(input.daysRemaining) || 1),
  );
  return {
    cap,
    spent: Math.round(spent * 100) / 100,
    activeReservedRemaining: Math.round(activeReservedRemaining * 100) / 100,
    inFlightReserved: Math.round(inFlightReserved * 100) / 100,
    reservedRemaining: Math.round(reservedRemaining * 100) / 100,
    available,
    suggestedDaily: Math.floor(available / daysRemaining * 100) / 100,
  };
}

export function buildMetaAdsPayloads(context: MetaAdsPublishContext) {
  const { draft, pageId, whatsappPhoneNumber } = context;
  const isWhatsapp = draft.objective !== "site";
  const radiusKm = draft.radius_km ?? 25;
  const ageMin = draft.age_min ?? 18;
  const ageMax = draft.age_max ?? 65;
  const categories = draft.special_ad_categories ?? [];
  const whatsappDigits = String(whatsappPhoneNumber ?? "").replace(/\D/g, "");
  const whatsappLink = `https://wa.me/${whatsappDigits}${
    draft.whatsapp_message
      ? `?text=${encodeURIComponent(draft.whatsapp_message)}`
      : ""
  }`;
  const destinationLink = isWhatsapp
    ? whatsappLink
    : String(draft.destination_url);
  const callToAction = {
    type: isWhatsapp ? "WHATSAPP_MESSAGE" : "LEARN_MORE",
    value: isWhatsapp
      ? { app_destination: "WHATSAPP", link: destinationLink }
      : { link: destinationLink },
  };
  const endTime = new Date(Date.now() + draft.duration_days * 86_400_000)
    .toISOString();
  const maximumSpend = metaAdsMaximumSpend(draft);
  const campaign = {
    name: draft.name,
    objective: isWhatsapp ? "OUTCOME_ENGAGEMENT" : "OUTCOME_TRAFFIC",
    ...(maximumSpend >= 600
      ? { spend_cap: Math.round(maximumSpend * 100) }
      : {}),
    special_ad_categories: categories,
    special_ad_category_country: categories.length ? ["BR"] : undefined,
    status: "PAUSED",
  };
  const adset = {
    name: `${draft.name} — conjunto`,
    campaign_id: "",
    daily_budget: Math.round(draft.daily_budget * 100),
    billing_event: "IMPRESSIONS",
    optimization_goal: isWhatsapp ? "CONVERSATIONS" : "LINK_CLICKS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    destination_type: isWhatsapp ? "WHATSAPP" : "WEBSITE",
    end_time: endTime,
    promoted_object: isWhatsapp
      ? {
        page_id: pageId,
        whatsapp_phone_number: whatsappPhoneNumber,
      }
      : undefined,
    targeting: {
      age_min: ageMin,
      age_max: ageMax,
      genders: draft.gender === "male"
        ? [1]
        : draft.gender === "female"
        ? [2]
        : undefined,
      geo_locations: {
        cities: draft.cities.map((city) => ({
          key: city.id,
          radius: radiusKm,
          distance_unit: "kilometer",
        })),
      },
      interests: (draft.interests ?? []).map((interest) => ({
        id: interest.id,
        name: interest.name,
      })),
      behaviors: (draft.behaviors ?? []).map((behavior) => ({
        id: behavior.id,
        name: behavior.name,
      })),
      publisher_platforms: ["facebook", "instagram"],
      facebook_positions: ["feed", "story"],
      instagram_positions: ["stream", "story"],
    },
    targeting_automation: { advantage_audience: 0 },
    status: "PAUSED",
  };
  const commonCreative = {
    name: `${draft.name} — criativo`,
    object_story_spec: {
      page_id: pageId,
      link_data: draft.media_type === "image"
        ? {
          image_hash: "",
          message: draft.primary_text,
          name: draft.headline,
          description: draft.description,
          link: destinationLink,
          call_to_action: callToAction,
        }
        : undefined,
      video_data: draft.media_type === "video"
        ? {
          video_id: "",
          message: draft.primary_text,
          title: draft.headline,
          link_description: draft.description,
          call_to_action: callToAction,
        }
        : undefined,
    },
    degrees_of_freedom_spec: {
      creative_features_spec: {
        standard_enhancements: { enroll_status: "OPT_OUT" },
        multi_advertiser_ads: { enroll_status: "OPT_OUT" },
      },
    },
  };
  return {
    campaign,
    adset,
    creative: commonCreative,
    ad: {
      name: `${draft.name} — anúncio`,
      adset_id: "",
      creative: { creative_id: "" },
      status: "PAUSED",
    },
  };
}

function safeGraphMessage(
  body: { error?: { message?: unknown } } | null,
  fallback: string,
): string {
  const message = cleanText(body?.error?.message, 500);
  // Meta error messages can echo request values. Never allow credentials into errors.
  return message
    ? message.replace(
      /access_token(?:=|%3D)[^&\s]+/gi,
      "access_token=[redacted]",
    )
    : fallback;
}

// Graph responses vary by endpoint; callers validate the fields they consume.
export async function metaGraphRequest(
  path: string,
  options: {
    accessToken: string;
    method?: "GET" | "POST" | "DELETE";
    params?: Record<string, unknown>;
    fetchImpl?: typeof fetch;
    formData?: FormData;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = new URL(`${META_GRAPH_URL}/${path.replace(/^\/+/, "")}`);
  const method = options.method ?? "GET";
  const init: RequestInit = { method };
  if (method === "GET") {
    Object.entries(options.params ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(
          key,
          typeof value === "string" ? value : JSON.stringify(value),
        );
      }
    });
    // Authorization headers prevent tokens appearing in URLs and access logs.
    init.headers = { Authorization: `Bearer ${options.accessToken}` };
  } else if (options.formData) {
    init.headers = { Authorization: `Bearer ${options.accessToken}` };
    init.body = options.formData;
  } else {
    const form = new URLSearchParams();
    Object.entries(options.params ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        form.set(
          key,
          typeof value === "string" ? value : JSON.stringify(value),
        );
      }
    });
    init.headers = {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
    init.body = form;
  }
  const response = await fetchImpl(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) {
    const error = new Error(
      safeGraphMessage(body, `Meta Graph HTTP ${response.status}`),
    ) as MetaGraphError;
    error.graphCode = Number(body?.error?.code || 0);
    error.graphSubcode = Number(body?.error?.error_subcode || 0);
    error.status = response.status;
    throw error;
  }
  return body;
}

export async function uploadMetaAdsMedia(
  context: MetaAdsPublishContext,
  fetchImpl: typeof fetch,
): Promise<{ imageHash?: string; videoId?: string }> {
  const account = context.adAccountId;
  if (context.draft.media_type === "video") {
    const result = await metaGraphRequest(`${account}/advideos`, {
      accessToken: context.accessToken,
      method: "POST",
      params: { file_url: context.draft.media_url },
      fetchImpl,
    });
    if (!result?.id) throw new Error("Meta não retornou o vídeo enviado");
    return { videoId: String(result.id) };
  }

  const mediaResponse = await fetchImpl(context.draft.media_url, {
    redirect: "follow",
  });
  if (!mediaResponse.ok) throw new Error("Não foi possível baixar a imagem");
  const contentType = mediaResponse.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error("A mídia informada não é uma imagem");
  }
  const bytes = await mediaResponse.arrayBuffer();
  if (bytes.byteLength > 30 * 1024 * 1024) {
    throw new Error("A imagem excede o limite de 30 MB");
  }
  const form = new FormData();
  form.set(
    "filename",
    new Blob([bytes], { type: contentType }),
    "creative",
  );
  const result = await metaGraphRequest(`${account}/adimages`, {
    accessToken: context.accessToken,
    method: "POST",
    formData: form,
    fetchImpl,
  });
  const images = result?.images && Object.values(result.images);
  const firstImage = Array.isArray(images) && images[0] &&
      typeof images[0] === "object"
    ? images[0] as { hash?: unknown }
    : null;
  const hash = firstImage
    ? String(firstImage.hash || "")
    : "";
  if (!hash) throw new Error("Meta não retornou o hash da imagem");
  return { imageHash: hash };
}

async function deleteGraphEntity(
  id: string,
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<void> {
  try {
    await metaGraphRequest(id, {
      accessToken,
      method: "DELETE",
      fetchImpl,
    });
  } catch {
    // Rollback is best-effort; preserve the original publish error.
  }
}

export async function rollbackMetaAdsCampaign(
  ids: Partial<MetaAdsEntityIds> | null | undefined,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const campaignId = String(ids?.campaign_id ?? "").trim();
  if (!campaignId) return false;
  try {
    await metaGraphRequest(campaignId, {
      accessToken,
      method: "DELETE",
      fetchImpl,
    });
    return true;
  } catch {
    return false;
  }
}

export async function publishMetaAdsCampaign(
  context: MetaAdsPublishContext,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<MetaAdsEntityIds> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const created: string[] = [];
  let uploadedMedia: { imageHash?: string; videoId?: string } | null = null;
  try {
    const media = await uploadMetaAdsMedia(context, fetchImpl);
    uploadedMedia = media;
    const payloads = buildMetaAdsPayloads(context);

    const campaign = await metaGraphRequest(
      `${context.adAccountId}/campaigns`,
      {
        accessToken: context.accessToken,
        method: "POST",
        params: payloads.campaign,
        fetchImpl,
      },
    );
    if (!campaign?.id) throw new Error("Meta não retornou a campanha");
    const campaignId = String(campaign.id);
    created.push(campaignId);

    const adset = await metaGraphRequest(`${context.adAccountId}/adsets`, {
      accessToken: context.accessToken,
      method: "POST",
      params: { ...payloads.adset, campaign_id: campaignId },
      fetchImpl,
    });
    if (!adset?.id) throw new Error("Meta não retornou o conjunto");
    const adsetId = String(adset.id);
    created.push(adsetId);

    const creativePayload = structuredClone(payloads.creative);
    if (context.draft.media_type === "image") {
      creativePayload.object_story_spec.link_data!.image_hash = media
        .imageHash!;
    } else {
      creativePayload.object_story_spec.video_data!.video_id = media.videoId!;
    }
    const creative = await metaGraphRequest(
      `${context.adAccountId}/adcreatives`,
      {
        accessToken: context.accessToken,
        method: "POST",
        params: creativePayload,
        fetchImpl,
      },
    );
    if (!creative?.id) throw new Error("Meta não retornou o criativo");
    const creativeId = String(creative.id);
    created.push(creativeId);

    const ad = await metaGraphRequest(`${context.adAccountId}/ads`, {
      accessToken: context.accessToken,
      method: "POST",
      params: {
        ...payloads.ad,
        adset_id: adsetId,
        creative: { creative_id: creativeId },
      },
      fetchImpl,
    });
    if (!ad?.id) throw new Error("Meta não retornou o anúncio");
    const adId = String(ad.id);
    created.push(adId);

    // Children become active before their parent to avoid partial delivery.
    for (const id of [adId, adsetId, campaignId]) {
      await metaGraphRequest(id, {
        accessToken: context.accessToken,
        method: "POST",
        params: { status: "ACTIVE" },
        fetchImpl,
      });
    }
    return {
      campaign_id: campaignId,
      adset_id: adsetId,
      creative_id: creativeId,
      ad_id: adId,
    };
  } catch (error) {
    for (const id of created.reverse()) {
      await deleteGraphEntity(id, context.accessToken, fetchImpl);
    }
    if (uploadedMedia?.videoId) {
      await deleteGraphEntity(
        uploadedMedia.videoId,
        context.accessToken,
        fetchImpl,
      );
    } else if (uploadedMedia?.imageHash) {
      try {
        await metaGraphRequest(`${context.adAccountId}/adimages`, {
          accessToken: context.accessToken,
          method: "DELETE",
          params: { hash: uploadedMedia.imageHash },
          fetchImpl,
        });
      } catch {
        // Preserve the original error when uploaded-media cleanup is rejected.
      }
    }
    throw error;
  }
}

export function publicMetaAdsError(error: unknown): {
  code: string;
  message: string;
} {
  const graph = error as MetaGraphError;
  if (
    [17, 613, 80004].includes(Number(graph?.graphCode)) || graph?.status === 429
  ) {
    return {
      code: "rate_limit",
      message:
        "A Meta limitou as solicitações. Tente novamente em alguns minutos.",
    };
  }
  if ([102, 190].includes(Number(graph?.graphCode)) || graph?.status === 401) {
    return {
      code: "token_expired",
      message: "A conexão do Meta Ads venceu. Reconecte em Configurações.",
    };
  }
  if (graph?.graphCode === 200 || graph?.status === 403) {
    return {
      code: "permission",
      message: "A conexão não tem as permissões necessárias para esta ação.",
    };
  }
  return {
    code: "meta_request_failed",
    message:
      "A Meta não concluiu a solicitação. Revise a campanha e tente novamente.",
  };
}
