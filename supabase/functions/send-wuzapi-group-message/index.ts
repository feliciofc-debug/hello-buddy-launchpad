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
    const { groupJid, message, imageUrl, userId } = await req.json();

    if (!groupJid || !message || !userId) {
      return new Response(
        JSON.stringify({ error: "groupJid, message e userId são obrigatórios" }),
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

    console.log(`Enviando mensagem para grupo: ${groupJid}`);

    let response;
    let endpoint;

    if (imageUrl) {
      // COM IMAGEM
      endpoint = `${CONTABO_WUZAPI_URL}/chat/send/image`;
      response = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Token": token, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          Phone: groupJid,  // "120363xxxxx@g.us"
          Caption: message,
          Image: imageUrl
        }),
      });
    } else {
      // SÓ TEXTO
      endpoint = `${CONTABO_WUZAPI_URL}/chat/send/text`;
      response = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Token": token, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          Phone: groupJid,  // "120363xxxxx@g.us"
          Body: message
        }),
      });
    }

    const result = await response.json();
    console.log("Resultado envio:", JSON.stringify(result));

    // Log do envio
    await supabase.from("historico_envios").insert({
      whatsapp: groupJid,
      tipo: "grupo",
      mensagem: message.substring(0, 200),
      sucesso: response.ok,
      erro: response.ok ? null : JSON.stringify(result)
    });

    // Atualizar contador de mensagens do grupo
    if (response.ok) {
      await supabase.rpc('increment_group_messages', { group_jid: groupJid });
    }

    return new Response(
      JSON.stringify({ 
        success: response.ok, 
        result,
        endpoint 
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
