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
    const { groupJid, action, userId } = await req.json();

    if (!groupJid || !action || !userId) {
      return new Response(
        JSON.stringify({ error: "groupJid, action e userId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar token do afiliado
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes_afiliados")
      .select("wuzapi_token")
      .eq("user_id", userId)
      .single();

    if (clienteError || !cliente?.wuzapi_token) {
      console.error("Erro ao buscar cliente:", clienteError);
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado ou sem token WuzAPI" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = cliente.wuzapi_token;
    let endpoint: string;
    let body: object;

    switch (action) {
      case "announce":
        // Bloquear grupo - só admins podem enviar
        endpoint = `${CONTABO_WUZAPI_URL}/group/announce`;
        body = { groupjid: groupJid, announce: true };
        break;
      
      case "not_announce":
        // Desbloquear grupo - todos podem enviar
        endpoint = `${CONTABO_WUZAPI_URL}/group/announce`;
        body = { groupjid: groupJid, announce: false };
        break;
      
      case "locked":
        // Só admins podem editar configurações
        endpoint = `${CONTABO_WUZAPI_URL}/group/locked`;
        body = { groupjid: groupJid, locked: true };
        break;
      
      case "unlocked":
        // Todos podem editar configurações
        endpoint = `${CONTABO_WUZAPI_URL}/group/locked`;
        body = { groupjid: groupJid, locked: false };
        break;
      
      default:
        return new Response(
          JSON.stringify({ error: "Ação inválida. Use: announce, not_announce, locked, unlocked" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`Executando ${action} no grupo ${groupJid}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { 
        "Token": token, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    console.log("Resultado:", JSON.stringify(result));

    // Atualizar configuração no banco
    if (response.ok && (action === "announce" || action === "not_announce")) {
      await supabase
        .from("whatsapp_grupos_afiliado")
        .update({ is_announce: action === "announce" })
        .eq("group_jid", groupJid);
    }

    return new Response(
      JSON.stringify({ 
        success: response.ok, 
        result,
        action 
      }),
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
