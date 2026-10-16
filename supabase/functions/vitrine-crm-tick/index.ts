import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { runVitrineCrmTick } from "../_shared/vitrine-crm-tick-run.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
  try {
    const result = await runVitrineCrmTick(sb, {
      supabaseUrl: SUPABASE_URL,
      serviceKey: SERVICE_KEY,
    });
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[vitrine-crm-tick]", (e as Error).message);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
