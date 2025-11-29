import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { phone, message, leadId, leadTipo, strategy, userId } = body;

    console.log("[SEND-WA-PROSPECCAO] Recebido:", { phone, leadId, leadTipo });

    // Validar dados obrigatórios
    if (!phone || !message) {
      console.error("[SEND-WA-PROSPECCAO] Dados faltando:", { phone: !!phone, message: !!message });
      return new Response(JSON.stringify({
        error: 'Phone e message são obrigatórios',
        received: { phone: !!phone, message: !!message }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let WUZAPI_URL = Deno.env.get('WUZAPI_URL') || '';
    const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN');

    if (!WUZAPI_URL || !WUZAPI_TOKEN) {
      console.error("[SEND-WA-PROSPECCAO] Configuração Wuzapi incompleta");
      return new Response(JSON.stringify({
        error: "Configuração Wuzapi incompleta",
        details: { url: !!WUZAPI_URL, token: !!WUZAPI_TOKEN }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // CORREÇÃO: Remover barra final da URL se existir
    WUZAPI_URL = WUZAPI_URL.replace(/\/+$/, '');

    // Limpar telefone
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Garantir formato brasileiro (13 dígitos: 55 + DDD + número)
    let formattedPhone = cleanPhone;
    if (cleanPhone.length === 11) {
      formattedPhone = `55${cleanPhone}`;
    } else if (cleanPhone.length === 10) {
      formattedPhone = `55${cleanPhone}`;
    } else if (cleanPhone.length === 9) {
      // Sem DDD, usar 11 como padrão
      formattedPhone = `5511${cleanPhone}`;
    }

    console.log("[SEND-WA-PROSPECCAO] Telefone formatado:", formattedPhone);
    console.log("[SEND-WA-PROSPECCAO] Mensagem:", message.substring(0, 100) + "...");

    // Enviar via Wuzapi - payload CORRETO sem campo Id
    const wuzapiPayload = {
      Phone: formattedPhone,
      Body: message
    };
    
    const wuzapiEndpoint = `${WUZAPI_URL}/chat/send/text`;
    console.log("[SEND-WA-PROSPECCAO] Enviando para Wuzapi:", wuzapiEndpoint);

    const wuzapiResponse = await fetch(wuzapiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': WUZAPI_TOKEN
      },
      body: JSON.stringify(wuzapiPayload)
    });

    // Ler resposta como texto primeiro
    const responseText = await wuzapiResponse.text();
    console.log("[SEND-WA-PROSPECCAO] Status Wuzapi:", wuzapiResponse.status);
    console.log("[SEND-WA-PROSPECCAO] Resposta Wuzapi:", responseText);

    // Tentar fazer parse do JSON
    let wuzapiResult;
    try {
      wuzapiResult = JSON.parse(responseText);
    } catch (parseError) {
      console.warn("[SEND-WA-PROSPECCAO] Resposta não é JSON válido:", responseText);
      wuzapiResult = { raw: responseText, status: wuzapiResponse.status };
    }

    // Salvar no banco mesmo se houver erro parcial
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Salvar em mensagens_enviadas
    const { error: insertError } = await supabase.from('mensagens_enviadas').insert({
      lead_id: leadId || null,
      lead_tipo: leadTipo || 'b2c',
      phone: formattedPhone,
      message: message,
      strategy: strategy || null,
      wuzapi_response: wuzapiResult,
      user_id: userId || null,
      sent_at: new Date().toISOString()
    });

    if (insertError) {
      console.warn("[SEND-WA-PROSPECCAO] Erro ao salvar mensagem:", insertError);
    }

    // Também salvar em whatsapp_messages para histórico (coluna correta: origem)
    const { error: historyError } = await supabase.from('whatsapp_messages').insert({
      user_id: userId || null,
      phone: formattedPhone,
      direction: 'sent',
      message: message,
      origem: 'prospeccao'
    });
    if (historyError) console.warn("[SEND-WA-PROSPECCAO] Erro ao salvar histórico:", historyError);

    return new Response(JSON.stringify({
      success: wuzapiResponse.ok,
      wuzapi_response: wuzapiResult,
      phone: formattedPhone,
      status: wuzapiResponse.status
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("[SEND-WA-PROSPECCAO] Erro geral:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
