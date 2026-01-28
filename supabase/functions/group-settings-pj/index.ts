import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOCAWEB_WUZAPI_URL = Deno.env.get("WUZAPI_URL") || "https://wuzapi.amzofertas.com.br";
const LOCAWEB_WUZAPI_TOKEN = Deno.env.get("WUZAPI_TOKEN") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { groupJid, userId, action, value } = await req.json();

    console.log(`⚙️ [PJ-GROUP-SETTINGS] Ação: ${action} para grupo: ${groupJid}`);

    if (!groupJid || !action) {
      return new Response(
        JSON.stringify({ success: false, error: "groupJid e action são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar token do usuário
    let wuzapiToken = LOCAWEB_WUZAPI_TOKEN;
    if (userId) {
      const { data: config } = await supabase
        .from("pj_clientes_config")
        .select("wuzapi_token")
        .eq("user_id", userId)
        .maybeSingle();

      if (config?.wuzapi_token) {
        wuzapiToken = config.wuzapi_token;
      }
    }

    let response: Response;
    let payload: any;

    switch (action) {
      case "set_announce":
        // Ativar/desativar modo somente admins
        response = await fetch(`${LOCAWEB_WUZAPI_URL}/group/settings`, {
          method: "POST",
          headers: {
            "Token": wuzapiToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            GroupJID: groupJid,
            Action: value ? "announce" : "not_announce",
          }),
        });
        payload = await response.json();
        break;

      case "set_locked":
        // Bloquear/desbloquear edição de info
        response = await fetch(`${LOCAWEB_WUZAPI_URL}/group/settings`, {
          method: "POST",
          headers: {
            "Token": wuzapiToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            GroupJID: groupJid,
            Action: value ? "locked" : "unlocked",
          }),
        });
        payload = await response.json();
        break;

      case "get_info":
        // Obter informações do grupo
        response = await fetch(`${LOCAWEB_WUZAPI_URL}/group/info`, {
          method: "POST",
          headers: {
            "Token": wuzapiToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            GroupJID: groupJid,
          }),
        });
        payload = await response.json();
        break;

      case "get_participants":
        // Obter participantes do grupo
        response = await fetch(`${LOCAWEB_WUZAPI_URL}/group/participants`, {
          method: "POST",
          headers: {
            "Token": wuzapiToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            GroupJID: groupJid,
          }),
        });
        payload = await response.json();
        break;

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Ação "${action}" não reconhecida` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`⚙️ [PJ-GROUP-SETTINGS] Resposta:`, { ok: response.ok, action });

    const success = response.ok && payload?.success !== false;

    // Atualizar banco se necessário
    if (success && (action === "set_announce" || action === "get_info")) {
      await supabase
        .from("pj_grupos_whatsapp")
        .update({
          is_announce: action === "set_announce" ? value : payload?.IsAnnounce,
          updated_at: new Date().toISOString(),
        })
        .eq("grupo_jid", groupJid)
        .eq("user_id", userId);
    }

    return new Response(
      JSON.stringify({
        success,
        action,
        data: payload,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ [PJ-GROUP-SETTINGS] Erro:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
