import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { hasPublishableMlLocation } from "../_shared/ml-location.ts";

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
      .select("nickname, status, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: cfg } = await admin.from("empresa_config")
      .select("ml_location_json")
      .eq("user_id", user.id)
      .maybeSingle();

    const status = conta?.status ?? "revoked";
    return new Response(JSON.stringify({
      success: true,
      connected: status === "active" || status === "needs_reauth",
      nickname: conta?.nickname ?? null,
      status,
      has_location: hasPublishableMlLocation(cfg?.ml_location_json),
      updated_at: conta?.updated_at ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
