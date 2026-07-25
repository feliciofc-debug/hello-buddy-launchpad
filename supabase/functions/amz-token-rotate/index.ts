// One-shot: salva WHATSAPP_AMZ_SYSTEM_USER_TOKEN no row do AMZ e roda Teste A.
// NÃO loga o valor do token em lugar nenhum.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const AMZ_USER_ID = "b7af0118-c506-4f87-8ac3-a0a11fd621fe";
  const AMZ_PHONE_NUMBER_ID = "1136417836228337";
  const TEST_TO = "5521964641312"; // Marcelo — número passado como destino do Teste A

  const token = Deno.env.get("WHATSAPP_AMZ_SYSTEM_USER_TOKEN") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, srk);

  if (!token) {
    return new Response(JSON.stringify({ ok: false, step: "env", error: "WHATSAPP_AMZ_SYSTEM_USER_TOKEN ausente" }), {
      headers: { ...cors, "Content-Type": "application/json" }, status: 200,
    });
  }

  // 1) UPDATE do row (sem logar token)
  const { data: upd, error: updErr } = await supabase
    .from("whatsapp_config")
    .update({ access_token: token, updated_at: new Date().toISOString() })
    .eq("user_id", AMZ_USER_ID)
    .eq("phone_number_id", AMZ_PHONE_NUMBER_ID)
    .select("id, user_id, phone_number_id, is_active, connection_method, updated_at");

  if (updErr) {
    return new Response(JSON.stringify({ ok: false, step: "update", error: updErr.message }), {
      headers: { ...cors, "Content-Type": "application/json" }, status: 200,
    });
  }

  // 2) Teste A: envia texto pela Graph API usando o token recém-salvo
  const graph = await fetch(`https://graph.facebook.com/v25.0/${AMZ_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: TEST_TO,
      type: "text",
      text: { body: "🔧 Teste A — rotação de token AMZ. Ignore." },
    }),
  });
  const graphJson = await graph.json().catch(() => ({}));

  // Sanitiza: nunca ecoa token
  return new Response(JSON.stringify({
    ok: graph.ok,
    step: "test_a",
    http_status: graph.status,
    message_id: graphJson?.messages?.[0]?.id ?? null,
    error_code: graphJson?.error?.code ?? null,
    error_message: graphJson?.error?.message ?? null,
    updated_rows: upd?.length ?? 0,
    row: upd?.[0] ?? null,
  }), { headers: { ...cors, "Content-Type": "application/json" }, status: 200 });
});
