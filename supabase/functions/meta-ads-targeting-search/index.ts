import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
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
  const query = String(body?.query ?? "").trim().slice(0, 100);
  const kind = body?.type === "city"
    ? "city"
    : body?.type === "interest"
    ? "interest"
    : "";
  if (!kind || query.length < 2) {
    return json({ error: "invalid_search" }, 400);
  }

  const admin = createClient(url, service);
  const { data: integration } = await admin
    .from("integrations")
    .select("access_token, token_expires_at")
    .eq("user_id", user.id)
    .eq("platform", "meta_ads")
    .eq("is_active", true)
    .maybeSingle();
  if (!integration?.access_token) {
    return json({ error: "not_connected" }, 409);
  }
  const expiresAt = Date.parse(String(integration.token_expires_at ?? ""));
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    return json({ error: "token_expired" }, 401);
  }

  try {
    const result = await metaGraphRequest("search", {
      accessToken: integration.access_token,
      params: kind === "city"
        ? {
          type: "adgeolocation",
          location_types: ["city"],
          q: query,
          country_code: "BR",
          limit: 20,
        }
        : { type: "adinterest", q: query, limit: 20 },
    });
    const data = (Array.isArray(result?.data) ? result.data : [])
      .filter((item: any) => item?.key || item?.id)
      .slice(0, 20)
      .map((item: any) => ({
        id: String(item.key || item.id),
        name: String(item.name || ""),
        ...(kind === "city"
          ? {
            region: item.region ? String(item.region) : null,
            country_name: item.country_name
              ? String(item.country_name)
              : "Brasil",
          }
          : {
            audience_size_lower_bound: Number(
              item.audience_size_lower_bound || 0,
            ),
            audience_size_upper_bound: Number(
              item.audience_size_upper_bound || 0,
            ),
          }),
      }));
    return json({ ok: true, type: kind, data });
  } catch (error) {
    const safe = publicMetaAdsError(error);
    return json({ ok: false, ...safe }, 502);
  }
});
