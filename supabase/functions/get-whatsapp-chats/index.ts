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
    
    console.log("🔍 Buscando chats do WhatsApp para usuário:", userId);
    
    const wuzapiUrl = Deno.env.get("WUZAPI_URL");
    const wuzapiToken = Deno.env.get("WUZAPI_TOKEN");

    if (!wuzapiUrl || !wuzapiToken) {
      throw new Error("Credenciais Wuzapi não configuradas");
    }

    const baseUrl = wuzapiUrl.endsWith("/") ? wuzapiUrl.slice(0, -1) : wuzapiUrl;

    // Tentar buscar chats
    let chatsData = [];
    
    try {
      // Endpoint 1: /chats
      console.log(`📡 Tentando endpoint: ${baseUrl}/chats`);
      const response = await fetch(`${baseUrl}/chats`, {
        method: "GET",
        headers: {
          "Token": wuzapiToken,
          "Accept": "application/json"
        }
      });

      console.log("📡 Status:", response.status);

      if (response.ok) {
        const text = await response.text();
        const data = JSON.parse(text);
        
        // A estrutura pode variar
        chatsData = Array.isArray(data) ? data : (data.chats || data.data?.Chats || []);
        console.log(`✅ ${chatsData.length} chats encontrados`);
      }
    } catch (error) {
      console.error("❌ Erro ao buscar chats:", error);
    }

    // Separar grupos de contatos individuais
    const grupos = chatsData.filter((chat: any) => 
      chat.JID?.endsWith("@g.us") || 
      chat.id?.endsWith("@g.us") ||
      chat.isGroup === true
    ).map((g: any) => ({
      id: g.JID || g.id,
      nome: g.Name || g.name || g.subject || "Grupo sem nome",
      membros: g.Participants?.length || g.participants?.length || 0
    }));

    const contatos = chatsData.filter((chat: any) => 
      chat.JID?.endsWith("@s.whatsapp.net") || 
      chat.id?.endsWith("@s.whatsapp.net") ||
      (!chat.isGroup && !chat.JID?.endsWith("@g.us") && !chat.id?.endsWith("@g.us"))
    ).map((c: any) => ({
      id: c.JID || c.id,
      nome: c.Name || c.name || c.pushName || (c.JID || c.id).split("@")[0],
      telefone: (c.JID || c.id).split("@")[0]
    }));

    console.log(`📊 Resumo: ${grupos.length} grupos, ${contatos.length} contatos`);

    return new Response(
      JSON.stringify({
        success: true,
        grupos,
        contatos,
        total: chatsData.length
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
