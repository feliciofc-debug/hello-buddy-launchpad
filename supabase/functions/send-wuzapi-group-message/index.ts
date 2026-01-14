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

    // Para grupos, o WuzAPI precisa do JID completo com @g.us no campo Phone
    // MAS alguns endpoints exigem apenas o número sem @g.us
    const groupPhone = groupJid.includes('@g.us') ? groupJid : `${groupJid}@g.us`;
    
    console.log(`Enviando mensagem para grupo: ${groupPhone}`);

    let response: Response;
    let endpoint: string;

    if (imageUrl) {
      // COM IMAGEM (com fallback robusto para texto)
      endpoint = `${CONTABO_WUZAPI_URL}/chat/send/image`;
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Phone: groupPhone,
          Caption: message,
          Image: imageUrl,
        }),
      });

      let result: any = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      // Alguns cenários retornam 200 mas com erro no payload.
      const payloadHasError =
        !!result &&
        (result.error || result.erro || result.success === false || result.status === "error");

      if (!response.ok || payloadHasError) {
        console.log("⚠️ Falha ao enviar imagem para grupo, tentando só texto...");
        endpoint = `${CONTABO_WUZAPI_URL}/chat/send/text`;
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Token": token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            Phone: groupPhone,
            Body: message,
          }),
        });

        const fallbackResult = await response.json().catch(() => null);
        console.log("Resultado envio (fallback texto):", JSON.stringify(fallbackResult));

        // Reusar a variável result para log/erro abaixo
        result = fallbackResult;
      } else {
        console.log("Resultado envio (imagem):", JSON.stringify(result));
      }

      // Log do envio
      await supabase.from("historico_envios").insert({
        whatsapp: groupJid,
        tipo: "grupo",
        mensagem: message.substring(0, 200),
        sucesso: response.ok,
        erro: response.ok ? null : JSON.stringify(result),
      });

      // Atualizar contador de mensagens do grupo
      if (response.ok) {
        await supabase.rpc("increment_group_messages", { group_jid: groupJid });
      }

      return new Response(
        JSON.stringify({
          success: response.ok,
          result,
          endpoint,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SÓ TEXTO
    endpoint = `${CONTABO_WUZAPI_URL}/chat/send/text`;
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Phone: groupPhone,
        Body: message,
      }),
    });

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
