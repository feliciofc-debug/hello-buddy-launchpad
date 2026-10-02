import { graphRequest, redactSecrets } from "./meta-ads-report.ts";

export type CampaignDraft = {
  name: string;
  message: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  dailyBudget: number;
  maxSpend: number;
  cityKeys?: string[];
  interestIds?: string[];
  minAge?: number;
  maxAge?: number;
};

export type Readiness = {
  accountStatus: number;
  fundingSource: string | null;
  pageId: string;
  instagramId?: string | null;
  whatsappPhone: string;
};

export type CreatedIds = {
  campaign_id?: string;
  adset_id?: string;
  creative_id?: string;
  ad_id?: string;
};

export const CREATION_ORDER = ["campaign", "adset", "creative", "ad"] as const;
// Ad creatives are immutable assets and have no PAUSED/ACTIVE delivery state.
export const ACTIVATION_ORDER = [
  "ad",
  "adset",
  "campaign",
] as const;

export function assertPublishConfirmed(value: unknown): void {
  if (value !== true) throw new Error("Confirmação explícita é obrigatória.");
}

export function validateDraft(value: any): CampaignDraft {
  const name = String(value?.name ?? "").trim();
  const message = String(value?.message ?? "").trim();
  const mediaUrl = String(value?.mediaUrl ?? "").trim();
  const mediaType = value?.mediaType;
  const dailyBudget = Number(value?.dailyBudget);
  const maxSpend = Number(value?.maxSpend);
  if (name.length < 3 || name.length > 120) {
    throw new Error("Nome deve ter entre 3 e 120 caracteres.");
  }
  if (!message || message.length > 2200) {
    throw new Error("Texto do anúncio inválido.");
  }
  if (!/^https:\/\//i.test(mediaUrl)) {
    throw new Error("A mídia deve usar uma URL HTTPS.");
  }
  if (mediaType !== "image" && mediaType !== "video") {
    throw new Error("Tipo de mídia inválido.");
  }
  if (!Number.isFinite(dailyBudget) || dailyBudget < 1) {
    throw new Error("Orçamento diário mínimo: R$ 1.");
  }
  if (!Number.isFinite(maxSpend) || maxSpend < dailyBudget) {
    throw new Error(
      "O gasto máximo deve ser maior ou igual ao orçamento diário.",
    );
  }
  const minAge = value?.minAge == null ? 18 : Number(value.minAge);
  const maxAge = value?.maxAge == null ? 65 : Number(value.maxAge);
  if (minAge < 18 || maxAge > 65 || minAge > maxAge) {
    throw new Error("Faixa etária inválida.");
  }
  return {
    name,
    message,
    mediaUrl,
    mediaType,
    dailyBudget,
    maxSpend,
    cityKeys: Array.isArray(value.cityKeys)
      ? value.cityKeys.map(String).slice(0, 25)
      : [],
    interestIds: Array.isArray(value.interestIds)
      ? value.interestIds.map(String).slice(0, 25)
      : [],
    minAge,
    maxAge,
  };
}

export function enforceMonthlyCap(
  alreadyCommitted: number,
  requested: number,
  cap = 200,
): void {
  if (
    ![alreadyCommitted, requested, cap].every(Number.isFinite) ||
    requested <= 0 || cap <= 0
  ) {
    throw new Error("Valores de orçamento inválidos.");
  }
  if (alreadyCommitted + requested > cap + 0.00001) {
    throw new Error(`Limite mensal de R$ ${cap.toFixed(2)} excedido.`);
  }
}

export function buildSafePayloads(
  draft: CampaignDraft,
  ready: Readiness,
  imageHash?: string,
) {
  const waLink = `https://wa.me/${ready.whatsappPhone.replace(/\D/g, "")}`;
  const targeting: Record<string, unknown> = {
    age_min: draft.minAge ?? 18,
    age_max: draft.maxAge ?? 65,
    geo_locations: draft.cityKeys?.length
      ? { cities: draft.cityKeys.map((key) => ({ key })) }
      : { countries: ["BR"] },
    publisher_platforms: ["facebook", "instagram"],
    facebook_positions: ["feed", "story"],
    instagram_positions: ["stream", "story"],
  };
  if (draft.interestIds?.length) {
    targeting.flexible_spec = [{
      interests: draft.interestIds.map((id) => ({ id })),
    }];
  }
  const linkData: Record<string, unknown> = {
    link: waLink,
    message: draft.message,
    call_to_action: {
      type: "WHATSAPP_MESSAGE",
      value: { app_destination: "WHATSAPP", link: waLink },
    },
  };
  if (imageHash) linkData.image_hash = imageHash;
  return {
    campaign: {
      name: draft.name,
      objective: "OUTCOME_ENGAGEMENT",
      special_ad_categories: [],
      status: "PAUSED",
    },
    adset: {
      name: `${draft.name} - conjunto`,
      daily_budget: Math.round(draft.dailyBudget * 100),
      billing_event: "IMPRESSIONS",
      optimization_goal: "CONVERSATIONS",
      destination_type: "WHATSAPP",
      promoted_object: { page_id: ready.pageId },
      targeting,
      status: "PAUSED",
    },
    creative: {
      name: `${draft.name} - criativo`,
      object_story_spec: {
        page_id: ready.pageId,
        ...(ready.instagramId ? { instagram_actor_id: ready.instagramId } : {}),
        link_data: linkData,
      },
      degrees_of_freedom_spec: {
        creative_features_spec: {
          standard_enhancements: { enroll_status: "OPT_OUT" },
          multi_advertiser_ads: { enroll_status: "OPT_OUT" },
        },
      },
    },
    ad: { name: `${draft.name} - anúncio`, status: "PAUSED" },
  };
}

type PublishDependencies = {
  request?: typeof graphRequest;
  fetcher?: typeof fetch;
};

export async function uploadAdMedia(
  accountId: string,
  token: string,
  draft: CampaignDraft,
  dependencies: PublishDependencies = {},
): Promise<{ imageHash?: string; videoId?: string }> {
  const request = dependencies.request ?? graphRequest;
  const fetcher = dependencies.fetcher ?? fetch;
  const account = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  if (draft.mediaType === "image") {
    const media = await fetcher(draft.mediaUrl);
    if (!media.ok) throw new Error("Não foi possível baixar a imagem.");
    const form = new FormData();
    form.set(
      "filename",
      new Blob([await media.arrayBuffer()], {
        type: media.headers.get("content-type") || "image/jpeg",
      }),
      "ad-image",
    );
    const uploaded = await request(`${account}/adimages`, token, {
      method: "POST",
      body: form,
    });
    const first = Object.values(uploaded.images ?? {})[0] as
      | { hash?: string }
      | undefined;
    if (!first?.hash) throw new Error("A Meta não retornou o hash da imagem.");
    return { imageHash: first.hash };
  }
  const form = new FormData();
  form.set("file_url", draft.mediaUrl);
  const uploaded = await request(`${account}/advideos`, token, {
    method: "POST",
    body: form,
  });
  if (!uploaded.id) throw new Error("A Meta não retornou o ID do vídeo.");
  return { videoId: String(uploaded.id) };
}

export async function publishMetaCampaign(
  accountId: string,
  token: string,
  draft: CampaignDraft,
  ready: Readiness,
  dependencies: PublishDependencies = {},
): Promise<Required<CreatedIds>> {
  const request = dependencies.request ?? graphRequest;
  const account = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const created: CreatedIds = {};
  try {
    const { imageHash, videoId } = await uploadAdMedia(
      account,
      token,
      draft,
      dependencies,
    );

    const payloads = buildSafePayloads(draft, ready, imageHash);
    if (videoId) {
      const link = (payloads.creative.object_story_spec as any).link_data;
      delete (payloads.creative.object_story_spec as any).link_data;
      (payloads.creative.object_story_spec as any).video_data = {
        video_id: videoId,
        message: draft.message,
        call_to_action: link.call_to_action,
      };
    }
    const create = async (edge: string, body: Record<string, unknown>) => {
      const form = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        form.set(
          key,
          typeof value === "string" ? value : JSON.stringify(value),
        );
      }
      const result = await request(`${account}/${edge}`, token, {
        method: "POST",
        body: form,
      });
      if (!result.id) throw new Error(`A Meta não retornou ID para ${edge}.`);
      return String(result.id);
    };
    created.campaign_id = await create("campaigns", payloads.campaign);
    created.adset_id = await create("adsets", {
      ...payloads.adset,
      campaign_id: created.campaign_id,
    });
    created.creative_id = await create("adcreatives", payloads.creative);
    created.ad_id = await create("ads", {
      ...payloads.ad,
      adset_id: created.adset_id,
      creative: { creative_id: created.creative_id },
    });

    for (
      const id of [
        created.ad_id,
        created.adset_id,
        created.campaign_id,
      ]
    ) {
      await request(id!, token, {
        method: "POST",
        body: new URLSearchParams({ status: "ACTIVE" }),
      });
    }
    return created as Required<CreatedIds>;
  } catch (error) {
    await rollbackMetaEntities(created, token, request);
    throw new Error(redactSecrets(error));
  }
}

export async function rollbackMetaEntities(
  ids: CreatedIds,
  token: string,
  request: typeof graphRequest = graphRequest,
): Promise<void> {
  for (
    const id of [ids.ad_id, ids.creative_id, ids.adset_id, ids.campaign_id]
  ) {
    if (!id) continue;
    try {
      await request(id, token, { method: "DELETE" });
    } catch {
      // Best effort; the original sanitized error remains authoritative.
    }
  }
}
