// One-shot: ativa a linha do Marcelo em whatsapp_config usando o token vivo
// do secret WHATSAPP_TEST_ACCESS_TOKEN (que é System User permanente, expires_at=0).
// NÃO toca em nenhuma outra linha.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("WHATSAPP_TEST_ACCESS_TOKEN") ?? "";

const TARGET_USER_ID = "d2ca3f33-777b-465d-9961-59ce2eae393d"; // Marcelo
const TARGET_PHONE_NUMBER_ID = "1177205282145657";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!TOKEN) {
    return Response.json({ ok: false, error: "WHATSAPP_TEST_ACCESS_TOKEN ausente" }, { headers: cors, status: 400 });
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data, error } = await sb
    .from("whatsapp_config")
    .update({
      access_token: TOKEN,
      is_active: true,
      is_verified: true,
      connection_method: "system_user_permanent",
      alert_status: "none",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", TARGET_USER_ID)
    .eq("phone_number_id", TARGET_PHONE_NUMBER_ID)
    .select("user_id, phone_number_id, waba_id, is_active, is_verified, connection_method, alert_status, display_phone, business_name, LENGTH(access_token) as _tok_len".replace(", LENGTH(access_token) as _tok_len", ""))
    .single();

  if (error) return Response.json({ ok: false, error: error.message }, { headers: cors, status: 500 });
  return Response.json({ ok: true, row: data, token_len: TOKEN.length }, { headers: cors });
});
