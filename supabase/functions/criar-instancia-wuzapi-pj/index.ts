import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Usa a mesma infraestrutura Locaweb do sistema PJ existente
const LOCAWEB_WUZAPI_URL = Deno.env.get("WUZAPI_URL") || "https://wuzapi.amzofertas.com.br";
const LOCAWEB_WUZAPI_TOKEN = Deno.env.get("WUZAPI_TOKEN") || "";

async function safeReadJson(resp: Response) {
  const text = await resp.text();
  try {
    return { ok: true as const, json: JSON.parse(text), text };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "JSON parse failed", text };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, action } = await req.json();

    console.log(`📱 [PJ-WUZAPI] Ação: ${action} para user: ${userId}`);

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "userId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar ou criar configuração do cliente PJ
    let { data: clienteConfig, error: configError } = await supabase
      .from("pj_clientes_config")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!clienteConfig) {
      // Criar configuração inicial
      const { data: newConfig, error: insertError } = await supabase
        .from("pj_clientes_config")
        .insert({
          user_id: userId,
          wuzapi_token: LOCAWEB_WUZAPI_TOKEN,
          wuzapi_instance_name: "pj-default",
          wuzapi_port: 8080,
        })
        .select()
        .single();

      if (insertError) {
        console.error("❌ Erro ao criar config:", insertError);
        throw insertError;
      }
      clienteConfig = newConfig;
    }

    const wuzapiToken = clienteConfig.wuzapi_token || LOCAWEB_WUZAPI_TOKEN;

    if (action === "connect" || action === "qrcode") {
      // Gerar QR Code para conexão
      console.log("📲 Gerando QR Code...");

      const connectResponse = await fetch(`${LOCAWEB_WUZAPI_URL}/session/connect`, {
        method: "POST",
        headers: {
          "Token": wuzapiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const connectParsed = await safeReadJson(connectResponse);
      if (!connectParsed.ok) {
        console.error("❌ Resposta /session/connect não é JSON:", connectParsed.text);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Resposta inválida do servidor WuzAPI (connect)",
            raw: connectParsed.text?.slice(0, 500) || "",
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const connectData = connectParsed.json;
      console.log("📲 Resposta connect:", connectData);

      if (connectData?.success !== false) {
        // Buscar QR Code
        const qrResponse = await fetch(`${LOCAWEB_WUZAPI_URL}/session/qr`, {
          method: "GET",
          headers: { "Token": wuzapiToken },
        });

        const qrParsed = await safeReadJson(qrResponse);
        if (!qrParsed.ok) {
          console.error("❌ Resposta /session/qr não é JSON:", qrParsed.text);
          return new Response(
            JSON.stringify({
              success: false,
              error: "Resposta inválida do servidor WuzAPI (qr)",
              raw: qrParsed.text?.slice(0, 500) || "",
            }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const qrData = qrParsed.json;
        console.log("📲 QR Data:", qrData?.success);

        return new Response(
          JSON.stringify({
            success: true,
            qrCode: qrData?.QRCode || qrData?.data?.QRCode || qrData?.qr?.QRCode,
            status: "awaiting_scan",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: connectData.error || "Erro ao conectar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "status") {
      // Verificar status da conexão
      const statusResponse = await fetch(`${LOCAWEB_WUZAPI_URL}/session/status`, {
        method: "GET",
        headers: { "Token": wuzapiToken },
      });

      const statusParsed = await safeReadJson(statusResponse);
      if (!statusParsed.ok) {
        console.error("❌ Resposta /session/status não é JSON:", statusParsed.text);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Resposta inválida do servidor WuzAPI (status)",
            raw: statusParsed.text?.slice(0, 500) || "",
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const statusData = statusParsed.json;
      console.log("📊 Status:", statusData);

      const isConnected = statusData?.Connected || statusData?.loggedIn || false;
      const jid = statusData?.JID || statusData?.jid || "";

      // Atualizar status no banco
      await supabase
        .from("pj_clientes_config")
        .update({
          whatsapp_conectado: isConnected,
          wuzapi_jid: jid,
          ultimo_status_check: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({
          success: true,
          connected: isConnected,
          jid,
          raw: statusData,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "disconnect") {
      // Desconectar WhatsApp
      const disconnectResponse = await fetch(`${LOCAWEB_WUZAPI_URL}/session/disconnect`, {
        method: "POST",
        headers: {
          "Token": wuzapiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const disconnectParsed = await safeReadJson(disconnectResponse);
      if (!disconnectParsed.ok) {
        console.error("❌ Resposta /session/disconnect não é JSON:", disconnectParsed.text);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Resposta inválida do servidor WuzAPI (disconnect)",
            raw: disconnectParsed.text?.slice(0, 500) || "",
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const disconnectData = disconnectParsed.json;
      console.log("🔌 Disconnect:", disconnectData);

      // Atualizar status no banco
      await supabase
        .from("pj_clientes_config")
        .update({
          whatsapp_conectado: false,
          wuzapi_jid: null,
        })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true, message: "Desconectado com sucesso" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Ação não reconhecida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ [PJ-WUZAPI] Erro:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
