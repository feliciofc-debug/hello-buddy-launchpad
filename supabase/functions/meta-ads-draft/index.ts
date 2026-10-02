import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  generateMetaAdsCopy,
  metaAdsMaximumSpend,
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
    .select("id")
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
  let copyGenerated = false;
  if (body?.generate_copy === true) {
    const copy = await generateMetaAdsCopy({
      draft: draftInput,
      apiKey: Deno.env.get("LOVABLE_API_KEY"),
    });
    draftInput.primary_text = copy.primary_text;
    draftInput.headline = copy.headline;
    copyGenerated = copy.generated;
  }
  const validated = validateMetaAdsDraft(draftInput);
  if (!validated.ok) return json(validated, 400);
  const draft = validated.draft;
  const values = {
    user_id: user.id,
    rascunho: draft,
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
    return json({ ok: true, data, copy_generated: copyGenerated });
  }
  const { data, error } = await admin.from("meta_ads_campanhas")
    .insert(values)
    .select("id,rascunho,status,gasto_maximo,criado_em")
    .single();
  if (error) return json({ error: "draft_save_failed" }, 500);
  return json({ ok: true, data, copy_generated: copyGenerated }, 201);
});
