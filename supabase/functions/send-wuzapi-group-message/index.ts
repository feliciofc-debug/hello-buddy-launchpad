import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // 🔥 BUSCAR INSTÂNCIA CONECTADA DO USUÁRIO (igual send-wuzapi-message)
    let instance: any = null;
    
    // Prioridade: instância do usuário que está CONECTADA
    const { data: userInstance, error: instanceError } = await supabase
      .from('wuzapi_instances')
      .select('*')
      .eq('assigned_to_user', userId)
      .eq('is_connected', true)
      .limit(1)
      .maybeSingle();
    
    if (!instanceError && userInstance) {
      instance = userInstance;
      console.log('📡 Instância CONECTADA do usuário:', instance.instance_name, instance.wuzapi_url);
    } else {
      console.log('⚠️ Nenhuma instância conectada para o usuário:', userId);
    }
    
    // Se não encontrou instância conectada do usuário, buscar qualquer uma conectada
    if (!instance) {
      const { data: anyInstance, error: anyError } = await supabase
        .from('wuzapi_instances')
        .select('*')
        .eq('is_connected', true)
        .limit(1)
        .maybeSingle();
      
      if (!anyError && anyInstance) {
        instance = anyInstance;
        console.log('📡 Usando instância conectada disponível:', instance.instance_name, instance.wuzapi_url);
      } else {
        console.log('⚠️ Nenhuma instância conectada no sistema');
      }
    }
    
    // Fallback: tentar buscar de clientes_afiliados (compatibilidade)
    if (!instance) {
      const { data: cliente, error: clienteError } = await supabase
        .from("clientes_afiliados")
        .select("wuzapi_token, wuzapi_instance_id")
        .eq("user_id", userId)
        .single();

      if (!clienteError && cliente?.wuzapi_token) {
        // Usar URL de ambiente como fallback
        const envUrl = Deno.env.get('WUZAPI_URL') || "https://api2.amzofertas.com.br";
        instance = {
          wuzapi_url: envUrl,
          wuzapi_token: cliente.wuzapi_token,
          instance_name: 'fallback-afiliado',
          is_connected: true
        };
        console.log('📡 Usando token de clientes_afiliados como fallback');
      }
    }
    
    // Se ainda não encontrou, tentar variáveis de ambiente como fallback
    if (!instance) {
      const envUrl = Deno.env.get('WUZAPI_URL');
      const envToken = Deno.env.get('WUZAPI_TOKEN');
      
      if (envUrl && envToken) {
        instance = {
          wuzapi_url: envUrl,
          wuzapi_token: envToken,
          instance_name: 'env-fallback',
          is_connected: true
        };
        console.log('📡 Usando credenciais de ambiente como fallback');
      }
    }

    if (!instance) {
      console.error('❌ Nenhuma instância Wuzapi disponível');
      return new Response(
        JSON.stringify({ error: 'Nenhuma instância WhatsApp disponível. Conecte seu WhatsApp primeiro!' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // ✅ VERIFICAR SE ESTÁ CONECTADA
    if (!instance.is_connected) {
      console.error('❌ Instância não conectada:', instance.instance_name);
      return new Response(
        JSON.stringify({ error: 'WhatsApp não conectado! Conecte em Configurações.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const wuzapiUrl = instance.wuzapi_url;
    const token = instance.wuzapi_token;
    
    console.log('🌐 URL:', wuzapiUrl);
    console.log('🔑 Token:', token.substring(0, 10) + '...');
    console.log('📍 Instância:', instance.instance_name);
    
    const baseUrl = wuzapiUrl.endsWith('/') ? wuzapiUrl.slice(0, -1) : wuzapiUrl;

    // Para grupos, o WuzAPI precisa do JID completo com @g.us no campo Phone
    // MAS alguns endpoints exigem apenas o número sem @g.us
    const groupPhone = groupJid.includes('@g.us') ? groupJid : `${groupJid}@g.us`;
    
    console.log(`Enviando mensagem para grupo: ${groupPhone}`);

    let response: Response;
    let endpoint: string;

    if (imageUrl) {
      // COM IMAGEM (com fallback robusto para texto)
      endpoint = `${baseUrl}/chat/send/image`;
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
        endpoint = `${baseUrl}/chat/send/text`;
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
    endpoint = `${baseUrl}/chat/send/text`;
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
