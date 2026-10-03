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

type SearchKind =
  | "city"
  | "interest"
  | "interest_suggestion"
  | "behavior"
  | "reach_estimate";

type GraphTarget = {
  id?: unknown;
  key?: unknown;
  name?: unknown;
  audience_size_lower_bound?: unknown;
  audience_size_upper_bound?: unknown;
  region?: unknown;
  city?: unknown;
  country?: unknown;
  country_code?: unknown;
  country_name?: unknown;
  children?: unknown;
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");

const targetIds = (value: unknown, maximum: number) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))]
    .slice(0, maximum);
};

const targets = (value: unknown, maximum: number) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: Array<{ id: string; name: string }> = [];
  for (const item of value) {
    const target = item && typeof item === "object"
      ? item as Record<string, unknown>
      : {};
    const id = String(target.id ?? target.key ?? "").trim().slice(0, 100);
    const name = String(target.name ?? "").trim().slice(0, 160);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    result.push({ id, name });
    if (result.length >= maximum) break;
  }
  return result;
};

const mapTarget = (item: GraphTarget) => {
  const lower = Number(item.audience_size_lower_bound);
  const upper = Number(item.audience_size_upper_bound);
  const audienceScope = item.city
    ? "city"
    : item.country || item.country_code || item.country_name
    ? "country"
    : null;
  const hasLower = item.audience_size_lower_bound !== null &&
    item.audience_size_lower_bound !== undefined && Number.isFinite(lower);
  const hasUpper = item.audience_size_upper_bound !== null &&
    item.audience_size_upper_bound !== undefined && Number.isFinite(upper);
  return {
    id: String(item.key ?? item.id ?? ""),
    name: String(item.name ?? ""),
    ...(audienceScope && hasLower && lower >= 0
      ? {
        audience_size_lower_bound: lower,
        audience_size_scope: audienceScope,
      }
      : {}),
    ...(audienceScope && hasUpper && upper >= 0
      ? { audience_size_upper_bound: upper }
      : {}),
  };
};

function flattenTargets(value: unknown): GraphTarget[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const target = item as GraphTarget;
    return [target, ...flattenTargets(target.children)];
  });
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
  const query = String(body?.query ?? "").trim().slice(0, 100);
  const allowedKinds = new Set<SearchKind>([
    "city",
    "interest",
    "interest_suggestion",
    "behavior",
    "reach_estimate",
  ]);
  const kind = String(body?.type ?? "") as SearchKind;
  const interestList = targetIds(body?.interest_list, 50);
  if (
    !allowedKinds.has(kind) ||
    (["city", "interest", "behavior"].includes(kind) && query.length < 2) ||
    (kind === "interest_suggestion" && !interestList.length)
  ) {
    return json({ error: "invalid_search" }, 400);
  }

  const admin = createClient(url, service);
  const { data: integration } = await admin
    .from("integrations")
    .select("access_token, token_expires_at, ad_account_id")
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
    if (kind === "reach_estimate") {
      if (!integration.ad_account_id) {
        return json({
          ok: true,
          type: kind,
          available: false,
          reason: "ad_account_not_selected",
        });
      }
      const cities = targets(body?.cities ?? (body?.city ? [body.city] : []), 25);
      if (!cities.length) {
        return json({ error: "invalid_search" }, 400);
      }
      const ageMin = Math.max(18, Math.min(65, Number(body?.age_min) || 18));
      const ageMax = Math.max(ageMin, Math.min(65, Number(body?.age_max) || 65));
      const radius = Math.max(1, Math.min(80, Number(body?.radius_km) || 25));
      const targetingSpec = {
        age_min: ageMin,
        age_max: ageMax,
        ...(body?.gender === "male"
          ? { genders: [1] }
          : body?.gender === "female"
          ? { genders: [2] }
          : {}),
        geo_locations: {
          cities: cities.map((city) => ({
            key: city.id,
            radius,
            distance_unit: "kilometer",
          })),
        },
        interests: targets(body?.interests, 50),
        behaviors: targets(body?.behaviors, 50),
        publisher_platforms: ["facebook", "instagram"],
        facebook_positions: ["feed", "story"],
        instagram_positions: ["stream", "story"],
      };
      const result = await metaGraphRequest(
        `${integration.ad_account_id}/reachestimate`,
        {
          accessToken: integration.access_token,
          params: {
            targeting_spec: targetingSpec,
            optimization_goal: "REACH",
            locale: "pt_BR",
          },
        },
      );
      const estimate = Array.isArray(result?.data) ? result.data[0] : result;
      const lower = Number(
        estimate?.estimate_mau_lower_bound ?? estimate?.users_lower_bound,
      );
      const upper = Number(
        estimate?.estimate_mau_upper_bound ?? estimate?.users_upper_bound,
      );
      if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
        return json({ ok: true, type: kind, available: false });
      }
      return json({
        ok: true,
        type: kind,
        available: true,
        audience_size_lower_bound: lower,
        audience_size_upper_bound: upper,
      });
    }

    const params = kind === "city"
      ? {
        type: "adgeolocation",
        location_types: ["city"],
        q: query,
        country_code: "BR",
        locale: "pt_BR",
        limit: 20,
      }
      : kind === "interest"
      ? { type: "adinterest", q: query, locale: "pt_BR", limit: 20 }
      : kind === "interest_suggestion"
      ? {
        type: "adinterestsuggestion",
        interest_list: interestList,
        locale: "pt_BR",
        limit: 20,
      }
      : {
        type: "adTargetingCategory",
        class: "behaviors",
        locale: "pt_BR",
        limit: 1000,
      };
    const result = await metaGraphRequest("search", {
      accessToken: integration.access_token,
      params,
    });
    const selectedIds = new Set(interestList);
    const queryKey = normalize(query);
    const source = kind === "behavior"
      ? flattenTargets(result?.data).filter((item) =>
        normalize(item.name).includes(queryKey)
      )
      : flattenTargets(result?.data);
    const mapped = source
      .filter((item) => item?.key || item?.id)
      .filter((item) => !selectedIds.has(String(item.key || item.id)))
      .map((item) => kind === "city"
        ? {
          id: String(item.key || item.id),
          name: String(item.name || ""),
          region: item.region ? String(item.region) : null,
          country_name: item.country_name
            ? String(item.country_name)
            : "Brasil",
        }
        : mapTarget(item));
    const seen = new Set<string>();
    const data = mapped.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).slice(0, 20);
    return json({ ok: true, type: kind, data });
  } catch (error) {
    const safe = publicMetaAdsError(error);
    return json({ ok: false, ...safe }, 502);
  }
});
