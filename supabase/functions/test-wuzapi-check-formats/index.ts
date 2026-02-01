import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function safeReadJson(res: Response): Promise<{ json: any | null; text: string; status: number }> {
  const text = await res.text();
  const status = res.status;
  if (!text) return { json: null, text: "", status };
  try {
    return { json: JSON.parse(text), text, status };
  } catch {
    return { json: null, text, status };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, userId } = await req.json();
    
    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Resolver instância PJ
    let baseUrl = Deno.env.get("WUZAPI_URL") || "https://wuzapi.amzofertas.com.br";
    let wuzapiToken = Deno.env.get("WUZAPI_TOKEN") || "";

    if (userId) {
      const { data: config } = await supabase
        .from("pj_clientes_config")
        .select("wuzapi_token, wuzapi_port")
        .eq("user_id", userId)
        .maybeSingle();

      if (config?.wuzapi_token) wuzapiToken = config.wuzapi_token;

      const targetPort = Number(config?.wuzapi_port || 8080);
      const { data: mappedInstance } = await supabase
        .from("wuzapi_instances")
        .select("wuzapi_url, wuzapi_token")
        .eq("assigned_to_user", userId)
        .eq("port", targetPort)
        .maybeSingle();

      if (mappedInstance?.wuzapi_url) baseUrl = mappedInstance.wuzapi_url.replace(/\/+$/, "");
      if (mappedInstance?.wuzapi_token) wuzapiToken = mappedInstance.wuzapi_token;
    }

    console.log(`🔍 [TEST] Testando múltiplos formatos para: ${phone}`);
    console.log(`📡 [TEST] URL base: ${baseUrl}`);

    const results: any[] = [];

    // Normalizar número
    let clean = phone.replace(/\D/g, "");
    if (!clean.startsWith("55")) clean = "55" + clean;

    // ==================================
    // TESTAR DIFERENTES ENDPOINTS
    // ==================================
    const endpoints = [
      { path: "/user/check", method: "POST" },
      { path: "/user/info", method: "POST" },
      { path: "/contact/info", method: "POST" },
      { path: "/chat/presence", method: "POST" },
      { path: "/contact/check", method: "POST" },
    ];

    // Testar cada endpoint
    for (const endpoint of endpoints) {
      console.log(`\n📞 [TEST] Testando ${endpoint.path}...`);
      
      // Diferentes formatos de body
      const bodies = [
        { Phone: clean },                           // PascalCase string
        { phone: clean },                           // camelCase string
        { Phone: [clean] },                         // PascalCase array
        { phone: [clean] },                         // camelCase array
        { phones: [clean] },                        // plural
        { Phones: [clean] },                        // plural PascalCase
        { jid: `${clean}@s.whatsapp.net` },        // JID direto
        { Jid: `${clean}@s.whatsapp.net` },        // JID PascalCase
      ];

      for (const body of bodies) {
        try {
          const resp = await fetch(`${baseUrl}${endpoint.path}`, {
            method: endpoint.method,
            headers: {
              "Token": wuzapiToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          const { json, text, status } = await safeReadJson(resp);
          
          const result = {
            endpoint: endpoint.path,
            body: body,
            status,
            success: resp.ok,
            response: json || text.slice(0, 500),
          };
          
          results.push(result);
          
          // Log apenas se não for 400/404
          if (status !== 400 && status !== 404) {
            console.log(`✅ [TEST] ${endpoint.path} com ${JSON.stringify(body).slice(0,50)}... -> ${status}:`, JSON.stringify(json || text).slice(0, 200));
          }
          
          // Se encontrou algo promissor (tem JID ou registrado), destacar
          if (json && (json.Jid || json.jid || json.JID || json.IsRegistered || json.isRegistered)) {
            console.log(`🎯 [TEST] ENCONTRADO! ${endpoint.path}:`, JSON.stringify(json));
          }
          
        } catch (err: any) {
          results.push({
            endpoint: endpoint.path,
            body: body,
            error: err.message,
          });
        }
      }
    }

    // ==================================
    // TESTAR ENVIO E CAPTURAR remoteJid
    // ==================================
    console.log(`\n📤 [TEST] Testando envio para capturar remoteJid...`);
    
    try {
      const sendResp = await fetch(`${baseUrl}/chat/send/text`, {
        method: "POST",
        headers: {
          "Token": wuzapiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Phone: clean,
          Body: "🔍 Teste técnico - capturando JID real",
        }),
      });

      const { json: sendJson, text: sendText, status: sendStatus } = await safeReadJson(sendResp);
      
      console.log(`📤 [TEST] Envio completo response:`, JSON.stringify(sendJson || sendText));
      
      results.push({
        endpoint: "/chat/send/text",
        body: { Phone: clean, Body: "..." },
        status: sendStatus,
        fullResponse: sendJson,
        // Tentar extrair remoteJid de diferentes locais
        remoteJid: 
          sendJson?.data?.key?.remoteJid ||
          sendJson?.key?.remoteJid ||
          sendJson?.remoteJid ||
          sendJson?.data?.RemoteJid ||
          sendJson?.RemoteJid ||
          null,
      });
    } catch (err: any) {
      results.push({
        endpoint: "/chat/send/text",
        error: err.message,
      });
    }

    // Filtrar resultados que não são 400/404
    const successfulResults = results.filter(r => r.status && r.status !== 400 && r.status !== 404);
    const failedResults = results.filter(r => r.status === 400 || r.status === 404 || r.error);

    return new Response(
      JSON.stringify({
        phone,
        normalized: clean,
        baseUrl: baseUrl.replace(/token=[^&]+/, "token=***"),
        summary: {
          total: results.length,
          successful: successfulResults.length,
          failed: failedResults.length,
        },
        successfulResults,
        failedSample: failedResults.slice(0, 5), // Apenas amostra
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ [TEST] Erro:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
