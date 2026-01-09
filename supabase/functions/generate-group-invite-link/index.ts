import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTABO_WUZAPI_URL = "https://api2.amzofertas.com.br";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { groupId, userId } = await req.json();

    if (!groupId || !userId) {
      return new Response(
        JSON.stringify({ error: "groupId e userId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar grupo
    const { data: grupo, error: grupoError } = await supabase
      .from("whatsapp_grupos_afiliado")
      .select("group_jid")
      .eq("id", groupId)
      .eq("user_id", userId)
      .single();

    if (grupoError || !grupo) {
      return new Response(
        JSON.stringify({ error: "Grupo não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar token do afiliado
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes_afiliados")
      .select("wuzapi_token")
      .eq("user_id", userId)
      .single();

    if (clienteError || !cliente?.wuzapi_token) {
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado ou sem token WuzAPI" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = cliente.wuzapi_token;
    const groupJid = grupo.group_jid;

    console.log(`Gerando link para grupo: ${groupJid}`);

    // Tentar múltiplos endpoints
    const endpoints = [
      "/chat/group/invitelink",
      "/group/invitelink",
      "/group/invite"
    ];

    let inviteLink: string | null = null;

    for (const endpoint of endpoints) {
      console.log(`Tentando endpoint: ${CONTABO_WUZAPI_URL}${endpoint}`);
      
      const response = await fetch(`${CONTABO_WUZAPI_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Token": token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ GroupJid: groupJid }),
      });

      const text = await response.text();
      console.log(`Resultado ${endpoint}:`, text);

      if (text.includes("404") || text.includes("not found")) {
        continue;
      }

      try {
        const result = JSON.parse(text);
        inviteLink = 
          result?.InviteLink || 
          result?.inviteLink || 
          result?.link || 
          result?.data?.InviteLink ||
          result?.data?.inviteLink ||
          result?.data?.link;
        
        if (inviteLink) break;
      } catch {
        console.warn("Não foi JSON válido:", text);
      }
    }

    if (!inviteLink) {
      return new Response(
        JSON.stringify({ error: "Não foi possível gerar o link de convite. Verifique se você é admin do grupo." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atualizar no banco
    await supabase
      .from("whatsapp_grupos_afiliado")
      .update({ invite_link: inviteLink })
      .eq("id", groupId);

    return new Response(
      JSON.stringify({ success: true, inviteLink }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Erro geral:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
