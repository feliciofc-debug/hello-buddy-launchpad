// One-shot: lê WHATSAPP_TEST_ACCESS_TOKEN do secret e grava na whatsapp_config
// do tenant de teste, junto com phone_number_id + waba_id do número de teste.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TEST_TOKEN = Deno.env.get("WHATSAPP_TEST_ACCESS_TOKEN") ?? "";

const TEST_USER_ID = "b7af0118-c506-4f87-8ac3-a0a11fd621fe";
const PHONE_NUMBER_ID = "1156251107576181";
const WABA_ID = "851111477791145";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!TEST_TOKEN) {
    return Response.json({ ok: false, error: "WHATSAPP_TEST_ACCESS_TOKEN não configurado" }, { headers: cors, status: 400 });
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Token de teste da Meta dura ~24h
  const expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();

  const graphBase = "https://graph.facebook.com/v25.0";
  const metaChecks: Record<string, unknown> = {};

  // Número de teste precisa estar registrado para envio/recebimento na Cloud API.
  try {
    const registerRes = await fetch(`${graphBase}/${PHONE_NUMBER_ID}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({ messaging_product: "whatsapp", pin: "000000" }),
    });
    const registerJson = await registerRes.json().catch(() => ({}));
    metaChecks.register_phone = {
      ok: registerRes.ok,
      status: registerRes.status,
      code: registerJson?.error?.code ?? null,
      message: registerJson?.error?.message ?? null,
    };
  } catch (error) {
    metaChecks.register_phone = { ok: false, error: String(error) };
  }

  // O webhook só recebe POST da Meta se o app estiver inscrito neste WABA.
  try {
    const subRes = await fetch(`${graphBase}/${WABA_ID}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });
    const subJson = await subRes.json().catch(() => ({}));
    metaChecks.subscribe_waba = {
      ok: subRes.ok,
      status: subRes.status,
      success: subJson?.success ?? null,
      code: subJson?.error?.code ?? null,
      message: subJson?.error?.message ?? null,
    };
  } catch (error) {
    metaChecks.subscribe_waba = { ok: false, error: String(error) };
  }

  try {
    const listRes = await fetch(`${graphBase}/${WABA_ID}/subscribed_apps`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });
    const listJson = await listRes.json().catch(() => ({}));
    metaChecks.subscribed_apps_check = {
      ok: listRes.ok,
      status: listRes.status,
      count: Array.isArray(listJson?.data) ? listJson.data.length : null,
      code: listJson?.error?.code ?? null,
      message: listJson?.error?.message ?? null,
    };
  } catch (error) {
    metaChecks.subscribed_apps_check = { ok: false, error: String(error) };
  }

  // Tenta detectar colunas existentes via upsert genérico
  const payload: Record<string, unknown> = {
    user_id: TEST_USER_ID,
    phone_number_id: PHONE_NUMBER_ID,
    waba_id: WABA_ID,
    access_token: TEST_TOKEN,
    is_active: true,
    is_verified: true,
    connection_method: "test_number",
    token_expires_at: expiresAt,
    alert_status: "none",
    display_phone: "+1 555 TEST (Meta sandbox)",
    business_name: "Moda Style (Sandbox Meta)",
    updated_at: new Date().toISOString(),
  };

  // Upsert por user_id
  const { data: existing } = await sb
    .from("whatsapp_config")
    .select("user_id")
    .eq("user_id", TEST_USER_ID)
    .maybeSingle();

  let res;
  if (existing) {
    res = await sb.from("whatsapp_config").update(payload).eq("user_id", TEST_USER_ID).select("user_id, phone_number_id, waba_id, is_active, connection_method, token_expires_at").single();
  } else {
    res = await sb.from("whatsapp_config").insert(payload).select("user_id, phone_number_id, waba_id, is_active, connection_method, token_expires_at").single();
  }

  if (res.error) {
    return Response.json({ ok: false, error: res.error.message }, { headers: cors, status: 500 });
  }
  return Response.json({ ok: true, row: res.data, meta_checks: metaChecks }, { headers: cors });
});
