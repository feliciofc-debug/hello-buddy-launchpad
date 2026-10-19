import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveTenantOwner } from "../_shared/amz-context.ts";
import { mlPickListingPackType, type MlListingPackPreference } from "../_shared/ml-api.ts";
import { ML_DEFAULT_CAR_CATEGORY } from "../_shared/ml-config.ts";
import {
  hasPublishableMlLocation,
  mlLocationCityName,
  mlLocationPlaceLabel,
  mlLocationStateName,
} from "../_shared/ml-location.ts";
import { getMlAccessTokenForUser } from "../_shared/ml-token.ts";

function formatPhonePreview(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return local;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: conta } = await admin.from("ml_contas")
      .select("nickname, status, updated_at, ml_user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: cfg } = await admin.from("empresa_config")
      .select("ml_location_json, ml_listing_pack_preference, ml_whatsapp_leads_all_ads")
      .eq("user_id", user.id)
      .maybeSingle();

    const owner = await resolveTenantOwner(admin as never, user.id);
    const sellerPhonePreview = formatPhonePreview(String(owner.phone ?? ""));

    const status = conta?.status ?? "revoked";
    const connected = status === "active" || status === "needs_reauth";
    const locJson = cfg?.ml_location_json;
    const locZip = (locJson as { location?: { zip_code?: string } } | null)?.location?.zip_code ?? null;

    let ml_has_vehicle_package = false;
    let ml_listing_pack_type: string | null = null;
    if (connected && conta?.ml_user_id) {
      try {
        const { accessToken } = await getMlAccessTokenForUser(admin as never, user.id);
        const pref = (cfg?.ml_listing_pack_preference ?? "destaque_first") as MlListingPackPreference;
        ml_listing_pack_type = await mlPickListingPackType(
          accessToken,
          Number(conta.ml_user_id),
          ML_DEFAULT_CAR_CATEGORY,
          pref,
        );
        ml_has_vehicle_package = !!ml_listing_pack_type;
      } catch {
        ml_has_vehicle_package = false;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      connected,
      nickname: conta?.nickname ?? null,
      status,
      has_location: hasPublishableMlLocation(locJson),
      store_zip: locZip,
      location_place: mlLocationPlaceLabel(locJson),
      location_city_name: mlLocationCityName(locJson),
      location_state_name: mlLocationStateName(locJson),
      seller_phone_preview: sellerPhonePreview,
      has_seller_phone: !!sellerPhonePreview,
      ml_has_vehicle_package,
      ml_listing_pack_type,
      ml_listing_pack_preference: cfg?.ml_listing_pack_preference ?? "destaque_first",
      ml_whatsapp_leads_all_ads: cfg?.ml_whatsapp_leads_all_ads === true,
      updated_at: conta?.updated_at ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
