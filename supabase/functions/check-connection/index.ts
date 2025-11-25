import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔍 Verificando status da conexão WhatsApp...");
    
    const wuzapiUrl = Deno.env.get("WUZAPI_URL");
    const wuzapiToken = Deno.env.get("WUZAPI_TOKEN");

    if (!wuzapiUrl || !wuzapiToken) {
      throw new Error("Credenciais Wuzapi não configuradas");
    }

    const baseUrl = wuzapiUrl.endsWith("/") ? wuzapiUrl.slice(0, -1) : wuzapiUrl;

    const response = await fetch(`${baseUrl}/session/status`, {
      headers: { 
        "Token": wuzapiToken,
        "Accept": "application/json"
      }
    });

    const text = await response.text();
    let data;
    
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error("Resposta inválida da API Wuzapi");
    }

    const connected = data.data?.Connected || data.Connected || false;
    const loggedIn = data.data?.LoggedIn || data.LoggedIn || false;

    console.log(`📊 Status: Connected=${connected}, LoggedIn=${loggedIn}`);

    return new Response(
      JSON.stringify({
        success: true,
        connected,
        loggedIn
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error: any) {
    console.error("❌ Erro:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        connected: false,
        loggedIn: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
