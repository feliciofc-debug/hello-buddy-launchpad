import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { getMetaAdsDashboard } from "../_shared/meta-ads-dashboard.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey || !authorization) {
    return json({ error: "unauthorized" }, 401);
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const admin = createClient(supabaseUrl, serviceKey);
  const result = await getMetaAdsDashboard({
    userId: user.id,
    period: body?.period,
    campaignId: body?.campaign_id,
    refresh: body?.refresh === true,
    loadIntegration: async (userId) => {
      const { data, error } = await admin
        .from("integrations")
        .select("access_token, token_expires_at, ad_account_id, ad_account_name, ad_account_currency, is_active")
        .eq("user_id", userId)
        .eq("platform", "meta_ads")
        .eq("is_active", true)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    loadPlatformCampaigns: async (userId) => {
      const { data, error } = await admin
        .from("meta_ads_campanhas")
        .select(
          "id,campaign_id,ad_id,status,rascunho,orcamento_diario,duracao_dias,gasto_maximo,aprovado_em",
        )
        .eq("user_id", userId)
        .in("status", ["publicando", "publicado", "pausado", "erro", "expirado"]);
      if (error) return [];
      return data ?? [];
    },
  });
  return json(result);
});
