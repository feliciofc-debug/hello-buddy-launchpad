import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { ML_API_BASE } from "../_shared/ml-config.ts";
import {
  hasPublishableMlLocation,
  mlZipCodeLookupErrorMessage,
  normalizeBrazilCep,
  parseMlZipCodeApiResponse,
} from "../_shared/ml-location.ts";
import { getMlAccessTokenForUser } from "../_shared/ml-token.ts";

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

    const body = await req.json().catch(() => ({}));
    const cep = normalizeBrazilCep(String(body?.cep ?? ""));
    if (!cep) {
      return new Response(JSON.stringify({
        success: false,
        error: "CEP inválido. Informe 8 dígitos (ex.: 01310-100).",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let accessToken: string;
    try {
      ({ accessToken } = await getMlAccessTokenForUser(admin as never, user.id));
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "ml_not_connected" || msg === "ml_needs_reauth") {
        return new Response(JSON.stringify({
          success: false,
          error: "Conecte sua conta do Mercado Livre antes de salvar o CEP da loja.",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    const zipRes = await fetch(`${ML_API_BASE}/countries/BR/zip_codes/${cep}`, {
      headers: { Authorization: `Bearer ${accessToken}`, accept: "application/json" },
    });
    const zipPayload = await zipRes.json().catch(() => ({}));
    if (!zipRes.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: mlZipCodeLookupErrorMessage(zipRes.status, zipPayload),
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const loc = parseMlZipCodeApiResponse(zipPayload);
    if (!loc || !hasPublishableMlLocation(loc)) {
      return new Response(JSON.stringify({
        success: false,
        error:
          "Este CEP não retornou cidade/estado válidos para anúncios no Mercado Livre. Tente outro CEP ou reconecte a conta.",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upsertError } = await admin.from("empresa_config").upsert({
      user_id: user.id,
      ml_location_json: loc,
    }, { onConflict: "user_id" });
    if (upsertError) throw new Error(upsertError.message);

    return new Response(JSON.stringify({
      success: true,
      has_location: true,
      ml_location_json: loc,
      message: "Localização da loja salva.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[ml-location-set]", (e as Error).message);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
