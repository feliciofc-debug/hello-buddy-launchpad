import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  calculateMetaAdsMonthlyAvailability,
  metaAdsMaximumSpend,
  metaGraphRequest,
  publicMetaAdsError,
  validateMetaAdsDraft,
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

const safeWizardState = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > 100_000) return null;
    return JSON.parse(serialized) as Record<string, unknown>;
  } catch {
    return null;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!["GET", "POST", "DELETE"].includes(req.method)) {
    return json({ error: "method_not_allowed" }, 405);
  }
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
  const admin = createClient(url, service);
  const { data: integration, error: integrationError } = await admin
    .from("integrations")
    .select(
      "id,access_token,token_expires_at,ad_account_id,limite_mensal_anuncios",
    )
    .eq("user_id", user.id)
    .eq("platform", "meta_ads")
    .eq("is_active", true)
    .maybeSingle();
  if (integrationError) return json({ error: "integration_check_failed" }, 500);
  if (!integration) return json({ error: "not_connected" }, 409);
  const requestUrl = new URL(req.url);
  const queryId = requestUrl.searchParams.get("id");

  if (req.method === "GET") {
    let query = admin.from("meta_ads_campanhas")
      .select(
        "id,rascunho,status,orcamento_diario,duracao_dias,gasto_maximo,campaign_id,adset_id,creative_id,ad_id,erro,criado_em,atualizado_em",
      )
      .eq("user_id", user.id)
      .order("criado_em", { ascending: false })
      .limit(queryId ? 1 : 50);
    if (queryId) query = query.eq("id", queryId);
    const { data, error } = await query;
    if (error) return json({ error: "draft_load_failed" }, 500);
    if (queryId && !data?.length) return json({ error: "not_found" }, 404);
    return json({ ok: true, data: queryId ? data[0] : data });
  }

  const body = await req.json().catch(() => ({}));
  if (req.method === "POST" && body?.action === "list") {
    const { data, error } = await admin.from("meta_ads_campanhas")
      .select(
        "id,rascunho,status,orcamento_diario,duracao_dias,gasto_maximo,criado_em,atualizado_em",
      )
      .eq("user_id", user.id)
      .eq("status", "rascunho")
      .order("atualizado_em", { ascending: false })
      .limit(50);
    if (error) return json({ error: "draft_load_failed" }, 500);
    return json({ ok: true, data: data ?? [] });
  }
  if (req.method === "POST" && body?.action === "delete") {
    const id = String(body?.id ?? "");
    if (!id) return json({ error: "id_required" }, 400);
    const { data, error } = await admin.from("meta_ads_campanhas")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "rascunho")
      .select("id")
      .maybeSingle();
    if (error) return json({ error: "draft_delete_failed" }, 500);
    if (!data) return json({ error: "not_found_or_not_draft" }, 404);
    return json({ ok: true, id });
  }
  if (req.method === "POST" && body?.action === "availability") {
    if (!integration.access_token || !integration.ad_account_id) {
      return json({ error: "meta_ads_not_ready" }, 409);
    }
    const expiresAt = Date.parse(String(integration.token_expires_at ?? ""));
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      return json({ error: "token_expired" }, 401);
    }
    const { data: platformRows, error: capLoadError } = await admin
      .from("meta_ads_campanhas")
      .select("id,campaign_id,gasto_maximo,status")
      .eq("user_id", user.id)
      .in("status", ["publicando", "publicado", "pausado"]);
    if (capLoadError) {
      return json({ error: "monthly_cap_check_failed" }, 500);
    }
    let actualSpent = 0;
    const activeCampaigns: Array<{
      maximumSpend: number;
      lifetimeSpent: number;
    }> = [];
    try {
      const accountInsights = await metaGraphRequest(
        `${integration.ad_account_id}/insights`,
        {
          accessToken: integration.access_token,
          params: {
            fields: "spend",
            level: "account",
            date_preset: "this_month",
            limit: 1,
          },
        },
      );
      actualSpent = Number(accountInsights?.data?.[0]?.spend || 0);
      await Promise.all(
        (platformRows ?? [])
          .filter((platform) =>
            platform.status !== "publicando" && platform.campaign_id
          )
          .map(async (platform) => {
            const campaign = await metaGraphRequest(
              String(platform.campaign_id),
              {
                accessToken: integration.access_token,
                params: { fields: "effective_status" },
              },
            );
            if (campaign?.effective_status !== "ACTIVE") return;
            const insights = await metaGraphRequest(
              `${platform.campaign_id}/insights`,
              {
                accessToken: integration.access_token,
                params: {
                  fields: "spend",
                  date_preset: "maximum",
                  limit: 1,
                },
              },
            );
            activeCampaigns.push({
              maximumSpend: Number(platform.gasto_maximo || 0),
              lifetimeSpent: Number(insights?.data?.[0]?.spend || 0),
            });
          }),
      );
    } catch (error) {
      const safe = publicMetaAdsError(error);
      return json({ ok: false, ...safe }, 502);
    }
    const now = new Date();
    const daysInMonth = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      0,
    )).getUTCDate();
    const availability = calculateMetaAdsMonthlyAvailability({
      monthlyCap: integration.limite_mensal_anuncios,
      actualSpent,
      activeCampaigns,
      inFlightReservations: (platformRows ?? [])
        .filter((platform) => platform.status === "publicando")
        .map((platform) => platform.gasto_maximo),
      daysRemaining: daysInMonth - now.getUTCDate() + 1,
    });
    return json({
      ok: true,
      action: "availability",
      monthly_cap: availability.cap,
      spent: availability.spent,
      available: availability.available,
    });
  }
  if (req.method === "POST" && body?.action === "save_wizard") {
    const state = safeWizardState(body?.wizard_state);
    if (!state) return json({ error: "invalid_wizard_state" }, 400);
    const id = String(body?.id ?? "");
    const dailyBudget = Math.max(0, Number(state.dailyBudget) || 0);
    const durationDays = Math.max(
      1,
      Math.min(365, Math.floor(Number(state.durationDays) || 1)),
    );
    const values = {
      orcamento_diario: dailyBudget,
      duracao_dias: durationDays,
      gasto_maximo: Math.round(dailyBudget * durationDays * 100) / 100,
      atualizado_em: new Date().toISOString(),
      erro: null,
    };
    if (id) {
      const { data: current } = await admin.from("meta_ads_campanhas")
        .select("rascunho")
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("status", "rascunho")
        .maybeSingle();
      if (!current) return json({ error: "not_found_or_not_draft" }, 404);
      const currentDraft = current.rascunho &&
          typeof current.rascunho === "object" &&
          !Array.isArray(current.rascunho)
        ? current.rascunho as Record<string, unknown>
        : {};
      const { data, error } = await admin.from("meta_ads_campanhas")
        .update({
          ...values,
          rascunho: { ...currentDraft, wizard_state: state },
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("status", "rascunho")
        .select(
          "id,rascunho,status,orcamento_diario,duracao_dias,gasto_maximo,criado_em,atualizado_em",
        )
        .maybeSingle();
      if (error) return json({ error: "draft_save_failed" }, 500);
      if (!data) return json({ error: "not_found_or_not_draft" }, 404);
      return json({ ok: true, data });
    }
    const { data, error } = await admin.from("meta_ads_campanhas")
      .insert({
        user_id: user.id,
        rascunho: { wizard_state: state },
        status: "rascunho",
        ...values,
      })
      .select(
        "id,rascunho,status,orcamento_diario,duracao_dias,gasto_maximo,criado_em,atualizado_em",
      )
      .single();
    if (error) return json({ error: "draft_save_failed" }, 500);
    return json({ ok: true, data }, 201);
  }
  const id = String(body?.id ?? queryId ?? "");
  if (req.method === "DELETE") {
    if (!id) return json({ error: "id_required" }, 400);
    const { data, error } = await admin.from("meta_ads_campanhas")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "rascunho")
      .select("id")
      .maybeSingle();
    if (error) return json({ error: "draft_delete_failed" }, 500);
    if (!data) return json({ error: "not_found_or_not_draft" }, 404);
    return json({ ok: true, id });
  }

  const supplied = body?.draft ?? body?.rascunho;
  const draftInput = supplied && typeof supplied === "object"
    ? { ...supplied }
    : {};
  const wizardState = safeWizardState(
    body?.wizard_state ?? draftInput.wizard_state,
  );
  const validated = validateMetaAdsDraft(draftInput);
  if (!validated.ok) return json(validated, 400);
  const draft = validated.draft;
  const values = {
    user_id: user.id,
    rascunho: wizardState ? { ...draft, wizard_state: wizardState } : draft,
    status: "rascunho",
    orcamento_diario: draft.daily_budget,
    duracao_dias: draft.duration_days,
    gasto_maximo: metaAdsMaximumSpend(draft),
    atualizado_em: new Date().toISOString(),
    erro: null,
  };
  if (id) {
    const { data, error } = await admin.from("meta_ads_campanhas")
      .update(values)
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "rascunho")
      .select("id,rascunho,status,gasto_maximo,atualizado_em")
      .maybeSingle();
    if (error) return json({ error: "draft_save_failed" }, 500);
    if (!data) return json({ error: "not_found_or_not_draft" }, 404);
    return json({ ok: true, data });
  }
  const { data, error } = await admin.from("meta_ads_campanhas")
    .insert(values)
    .select("id,rascunho,status,gasto_maximo,criado_em")
    .single();
  if (error) return json({ error: "draft_save_failed" }, 500);
  return json({ ok: true, data }, 201);
});
