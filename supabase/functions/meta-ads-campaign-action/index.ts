import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  calculateMetaAdsMonthlyAvailability,
  checkMetaAdsReactivationAvailability,
  isMetaAdsCampaignEnded,
  metaGraphRequest,
  publicMetaAdsError,
} from "../_shared/meta-ads-create.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

async function reactivationAvailability(input: {
  admin: any;
  userId: string;
  integration: {
    access_token: string;
    ad_account_id: string;
    limite_mensal_anuncios: number | string | null;
  };
  campaign: {
    id: string;
    campaign_id: string;
    gasto_maximo: number | string | null;
  };
}) {
  const { data: rows, error } = await input.admin
    .from("meta_ads_campanhas")
    .select("id,campaign_id,gasto_maximo,status")
    .eq("user_id", input.userId)
    .in("status", ["publicando", "publicado", "pausado"]);
  if (error) throw new Error("monthly_cap_check_failed");
  const accountInsights = await metaGraphRequest(
    `${input.integration.ad_account_id}/insights`,
    {
      accessToken: input.integration.access_token,
      params: {
        fields: "spend",
        level: "account",
        date_preset: "this_month",
        limit: 1,
      },
    },
  );
  const activeCampaigns: Array<{
    maximumSpend: number;
    lifetimeSpent: number;
  }> = [];
  await Promise.all((rows ?? [])
    .filter((row: any) =>
      row.id !== input.campaign.id && row.status !== "publicando" &&
      row.campaign_id
    )
    .map(async (row: any) => {
      const remote = await metaGraphRequest(String(row.campaign_id), {
        accessToken: input.integration.access_token,
        params: { fields: "effective_status" },
      });
      if (remote?.effective_status !== "ACTIVE") return;
      const insights = await metaGraphRequest(
        `${row.campaign_id}/insights`,
        {
          accessToken: input.integration.access_token,
          params: { fields: "spend", date_preset: "maximum", limit: 1 },
        },
      );
      activeCampaigns.push({
        maximumSpend: Number(row.gasto_maximo ?? 0),
        lifetimeSpent: Number(insights?.data?.[0]?.spend ?? 0),
      });
    }));
  const candidateInsights = await metaGraphRequest(
    `${input.campaign.campaign_id}/insights`,
    {
      accessToken: input.integration.access_token,
      params: { fields: "spend", date_preset: "maximum", limit: 1 },
    },
  );
  const availability = calculateMetaAdsMonthlyAvailability({
    monthlyCap: input.integration.limite_mensal_anuncios,
    actualSpent: Number(accountInsights?.data?.[0]?.spend ?? 0),
    activeCampaigns,
    inFlightReservations: (rows ?? [])
      .filter((row: any) => row.status === "publicando")
      .map((row: any) => row.gasto_maximo),
  });
  return {
    ...availability,
    ...checkMetaAdsReactivationAvailability({
      maximumSpend: input.campaign.gasto_maximo,
      lifetimeSpent: candidateInsights?.data?.[0]?.spend,
      available: availability.available,
    }),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization") ?? "";
  if (!url || !anon || !service || !authorization) {
    return json({ error: "unauthorized" }, 401);
  }
  const client = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return json({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? body?.campaign_id ?? "");
  const action = ["pause", "activate", "status"].includes(body?.action)
    ? body.action as "pause" | "activate" | "status"
    : "";
  if (!id || !action) return json({ error: "invalid_action" }, 400);

  const admin = createClient(url, service);
  const [campaignResult, integrationResult] = await Promise.all([
    admin.from("meta_ads_campanhas")
      .select("id,status,campaign_id,adset_id,ad_id,gasto_maximo,aprovado_em,duracao_dias")
      .eq("id", id).eq("user_id", user.id).maybeSingle(),
    admin.from("integrations").select("access_token,token_expires_at,ad_account_id,limite_mensal_anuncios")
      .eq("user_id", user.id).eq("platform", "meta_ads")
      .eq("is_active", true).maybeSingle(),
  ]);
  const campaign = campaignResult.data;
  const integration = integrationResult.data;
  if (!campaign?.campaign_id) return json({ error: "campaign_not_found" }, 404);
  if (!integration?.access_token) return json({ error: "not_connected" }, 409);
  const expiresAt = Date.parse(String(integration.token_expires_at ?? ""));
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    return json({ error: "token_expired" }, 401);
  }
  if (
    action === "activate" &&
    isMetaAdsCampaignEnded({
      approvedAt: campaign.aprovado_em,
      durationDays: campaign.duracao_dias,
    })
  ) {
    return json({
      error: "campaign_ended",
      message: "Campanha encerrada. Crie uma nova campanha.",
    }, 409);
  }

  try {
    if (action === "status") {
      const remote = await metaGraphRequest(campaign.campaign_id, {
        accessToken: integration.access_token,
        params: { fields: "id,name,status,effective_status" },
      });
      const effective = String(
        remote?.effective_status || remote?.status || "",
      );
      const localStatus = effective === "PAUSED"
        ? "pausado"
        : effective === "ACTIVE"
        ? "publicado"
        : campaign.status;
      if (localStatus !== campaign.status) {
        const { error: updateError } = await admin.from("meta_ads_campanhas")
          .update({
            status: localStatus,
            atualizado_em: new Date().toISOString(),
          }).eq("id", campaign.id).eq("user_id", user.id);
        if (updateError) {
          return json({ error: "campaign_status_save_failed" }, 500);
        }
      }
      return json({
        ok: true,
        id: campaign.id,
        status: localStatus,
        graph_status: remote?.status ?? null,
        effective_status: remote?.effective_status ?? null,
      });
    }

    const desired = action === "pause" ? "PAUSED" : "ACTIVE";
    if (action === "activate") {
      if (!integration.ad_account_id) {
        return json({ error: "account_not_selected" }, 409);
      }
      const availability = await reactivationAvailability({
        admin,
        userId: user.id,
        integration: {
          access_token: integration.access_token,
          ad_account_id: integration.ad_account_id,
          limite_mensal_anuncios: integration.limite_mensal_anuncios,
        },
        campaign: {
          id: campaign.id,
          campaign_id: campaign.campaign_id,
          gasto_maximo: campaign.gasto_maximo,
        },
      });
      if (!availability.ok) {
        return json({
          error: "monthly_cap_exceeded",
          message:
            `Esta campanha ainda pode gastar até ${availability.requested.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}, mas restam ${availability.available.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} no limite mensal.`,
          ...availability,
        }, 409);
      }
    }
    // On activation, restore children before the campaign parent.
    const ids = action === "activate"
      ? [campaign.ad_id, campaign.adset_id, campaign.campaign_id]
      : [campaign.campaign_id];
    for (const graphId of ids.filter(Boolean)) {
      await metaGraphRequest(String(graphId), {
        accessToken: integration.access_token,
        method: "POST",
        params: { status: desired },
      });
    }
    const localStatus = action === "pause" ? "pausado" : "publicado";
    const { data: saved, error: saveError } = await admin.from(
      "meta_ads_campanhas",
    ).update({
      status: localStatus,
      atualizado_em: new Date().toISOString(),
      erro: null,
    }).eq("id", campaign.id).eq("user_id", user.id).select("id").maybeSingle();
    if (saveError || !saved) {
      return json({ error: "campaign_status_save_failed" }, 500);
    }
    return json({ ok: true, id: campaign.id, status: localStatus });
  } catch (error) {
    const safe = publicMetaAdsError(error);
    return json({ ok: false, ...safe }, 502);
  }
});
