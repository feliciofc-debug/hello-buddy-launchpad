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
    const { userId } = await req.json();
    
    console.log("📱 Gerando QR Code para usuário:", userId);
    
    const wuzapiUrl = Deno.env.get("WUZAPI_URL");
    const wuzapiToken = Deno.env.get("WUZAPI_TOKEN");

    if (!wuzapiUrl || !wuzapiToken) {
      throw new Error("Credenciais Wuzapi não configuradas");
    }

    const baseUrl = wuzapiUrl.endsWith("/") ? wuzapiUrl.slice(0, -1) : wuzapiUrl;

    // 1. Conectar sessão
    console.log("🔌 Conectando sessão...");
    await fetch(`${baseUrl}/session/connect`, {
      method: "POST",
      headers: {
        "Token": wuzapiToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        Subscribe: ["All"],
        Immediate: true
      })
    });

    // 2. Aguardar um pouco para a sessão iniciar
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Pegar QR Code
    console.log("📸 Obtendo QR Code...");
    const qrResponse = await fetch(`${baseUrl}/session/qr`, {
      headers: { 
        "Token": wuzapiToken,
        "Accept": "application/json"
      }
    });

    const text = await qrResponse.text();
    console.log("📄 Resposta QR:", text.substring(0, 200));

    let qrData;
    try {
      qrData = JSON.parse(text);
    } catch (e) {
      throw new Error("Resposta inválida da API Wuzapi");
    }

    const qrCode = qrData.data?.QRCode || qrData.QRCode || qrData.qr;

    if (!qrCode) {
      throw new Error("QR Code não encontrado na resposta");
    }

    console.log("✅ QR Code gerado com sucesso");

    return new Response(
      JSON.stringify({
        success: true,
        qrCode
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
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
