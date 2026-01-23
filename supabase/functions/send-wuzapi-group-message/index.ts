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

    console.log("📤 [GROUP-MSG] Recebido:", { groupJid, hasImage: !!imageUrl, userId });

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

    // 🔥 BUSCAR INSTÂNCIA CONECTADA (igual ao PJ)
    let instance: any = null;
    
    // 1. Instância do usuário conectada
    const { data: userInstance } = await supabase
      .from('wuzapi_instances')
      .select('*')
      .eq('assigned_to_user', userId)
      .eq('is_connected', true)
      .limit(1)
      .maybeSingle();
    
    if (userInstance) {
      instance = userInstance;
      console.log('📡 Instância do usuário:', instance.instance_name);
    }
    
    // 2. Qualquer instância conectada
    if (!instance) {
      const { data: anyInstance } = await supabase
        .from('wuzapi_instances')
        .select('*')
        .eq('is_connected', true)
        .limit(1)
        .maybeSingle();
      
      if (anyInstance) {
        instance = anyInstance;
        console.log('📡 Instância disponível:', instance.instance_name);
      }
    }
    
    // 3. Token do cliente afiliado (fallback)
    if (!instance) {
      const { data: cliente } = await supabase
        .from("clientes_afiliados")
        .select("wuzapi_token")
        .eq("user_id", userId)
        .single();

      if (cliente?.wuzapi_token) {
        instance = {
          wuzapi_url: "https://api2.amzofertas.com.br",
          wuzapi_token: cliente.wuzapi_token,
          instance_name: 'afiliado-fallback',
          is_connected: true
        };
        console.log('📡 Usando token afiliado');
      }
    }
    
    // 4. Variáveis de ambiente
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
        console.log('📡 Usando env fallback');
      }
    }

    if (!instance) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma instância WhatsApp disponível' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = instance.wuzapi_url.endsWith('/') 
      ? instance.wuzapi_url.slice(0, -1) 
      : instance.wuzapi_url;
    const token = instance.wuzapi_token;
    
    // Formatar JID do grupo
    const groupPhone = groupJid.includes('@g.us') ? groupJid : `${groupJid}@g.us`;
    
    console.log(`🚀 Enviando para grupo: ${groupPhone}`);
    console.log(`🌐 URL: ${baseUrl}`);
    console.log(`🔑 Token: ${token.substring(0, 10)}...`);

    let response: Response;
    let endpoint: string;
    let payload: any;

    // ═══════════════════════════════════════════════════════════════
    // 🎯 LÓGICA SIMPLES IGUAL AO PJ: PASSA URL DIRETO PRO WUZAPI
    // ═══════════════════════════════════════════════════════════════

    if (imageUrl) {
      // COM IMAGEM - passa URL direto (igual PJ faz)
      endpoint = `${baseUrl}/chat/send/image`;
      payload = {
        Phone: groupPhone,
        Caption: message,
        Image: imageUrl,
      };
      
      console.log(`🖼️ Enviando imagem+texto:`, { endpoint, imageUrl: imageUrl.substring(0, 60) + '...' });
      
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let result = await response.json().catch(() => null);
      console.log(`📨 Resposta imagem:`, { ok: response.ok, result });

      // Se falhou com imagem → tenta só texto (fallback garantido)
      if (!response.ok || result?.success === false) {
        console.log("⚠️ Imagem falhou, enviando só texto+link...");
        
        endpoint = `${baseUrl}/chat/send/text`;
        payload = {
          Phone: groupPhone,
          Body: message,
        };
        
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Token": token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        result = await response.json().catch(() => null);
        console.log(`📨 Resposta texto (fallback):`, { ok: response.ok, result });
      }

      // Log do envio
      await supabase.from("historico_envios").insert({
        whatsapp: groupJid,
        tipo: "grupo",
        mensagem: message.substring(0, 200),
        sucesso: response.ok,
        erro: response.ok ? null : JSON.stringify(result),
      });

      if (response.ok) {
        try {
          await supabase.rpc("increment_group_messages", { group_jid: groupJid });
        } catch (e) { /* ignore */ }
      }

      return new Response(
        JSON.stringify({ success: response.ok, result, endpoint }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SÓ TEXTO
    endpoint = `${baseUrl}/chat/send/text`;
    payload = {
      Phone: groupPhone,
      Body: message,
    };
    
    console.log(`💬 Enviando só texto`);
    
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);
    console.log(`📨 Resposta:`, { ok: response.ok, result });

    // Log do envio
    await supabase.from("historico_envios").insert({
      whatsapp: groupJid,
      tipo: "grupo",
      mensagem: message.substring(0, 200),
      sucesso: response.ok,
      erro: response.ok ? null : JSON.stringify(result)
    });

    if (response.ok) {
      try {
        await supabase.rpc('increment_group_messages', { group_jid: groupJid });
      } catch (e) { /* ignore */ }
    }

    return new Response(
      JSON.stringify({ success: response.ok, result, endpoint }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("❌ Erro geral:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
