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
    const { groupJid, message, imageUrl, userId, productTitle, productLink, productPrice } = await req.json();

    console.log("📤 [PJ-GROUP] Recebido:", {
      groupJid,
      hasImage: !!imageUrl,
      userId,
      productTitle: productTitle?.substring(0, 30),
    });

    if (!groupJid) {
      return new Response(
        JSON.stringify({ success: false, error: "groupJid é obrigatório" }),
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

    // Montar mensagem completa
    let fullMessage = message || "";
    if (productTitle) {
      fullMessage = `🔥 *${productTitle}*\n\n`;
      if (productPrice) {
        fullMessage += `💰 *R$ ${productPrice}*\n\n`;
      }
      if (message) {
        fullMessage += `${message}\n\n`;
      }
      if (productLink) {
        fullMessage += `🛒 *Compre aqui:* ${productLink}`;
      }
    }

    console.log(`📱 [PJ-GROUP] Enviando para grupo ${groupJid}...`);

    let response: Response;
    let payload: any;

    if (imageUrl) {
      // Enviar com imagem
      response = await fetch(`${LOCAWEB_WUZAPI_URL}/chat/send/image`, {
        method: "POST",
        headers: {
          "Token": wuzapiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Phone: groupJid,
          Caption: fullMessage,
          Image: imageUrl,
        }),
      });

      payload = await response.json();
      console.log("📸 [PJ-GROUP] Resposta imagem:", { ok: response.ok, payload });

      // Fallback se imagem falhar
      if (!response.ok || payload?.success === false) {
        const errMsg = payload?.error || payload?.message || "";
        const isMediaError =
          errMsg.toLowerCase().includes("upload") ||
          errMsg.toLowerCase().includes("media") ||
          errMsg.toLowerCase().includes("websocket") ||
          errMsg.toLowerCase().includes("timed out");

        if (isMediaError) {
          console.log("🧯 [PJ-GROUP] Fallback para texto...");
          
          response = await fetch(`${LOCAWEB_WUZAPI_URL}/chat/send/text`, {
            method: "POST",
            headers: {
              "Token": wuzapiToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              Phone: groupJid,
              Body: fullMessage,
            }),
          });

          payload = await response.json();
          console.log("💬 [PJ-GROUP] Resposta texto (fallback):", { ok: response.ok, payload });
        }
      }
    } else {
      // Enviar só texto
      response = await fetch(`${LOCAWEB_WUZAPI_URL}/chat/send/text`, {
        method: "POST",
        headers: {
          "Token": wuzapiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Phone: groupJid,
          Body: fullMessage,
        }),
      });

      payload = await response.json();
      console.log("💬 [PJ-GROUP] Resposta texto:", { ok: response.ok, payload });
    }

    const success = response.ok && payload?.success !== false;

    if (success) {
      console.log(`✅ [PJ-GROUP] Enviado para ${groupJid}`);
    } else {
      console.error(`❌ [PJ-GROUP] Falha para ${groupJid}:`, payload);
    }

    return new Response(
      JSON.stringify({
        success,
        groupJid,
        response: payload,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ [PJ-GROUP] Erro geral:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
