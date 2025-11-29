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
    const { phone, message, leadId, leadTipo, strategy, userId } = await req.json();

    console.log("[SEND-WA-PROSPECCAO] Enviando para:", phone);

    const WUZAPI_URL = Deno.env.get('WUZAPI_URL');
    const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN');

    if (!WUZAPI_URL || !WUZAPI_TOKEN) {
      throw new Error("Configuração Wuzapi incompleta");
    }

    // Limpar telefone
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Garantir formato brasileiro
    let formattedPhone = cleanPhone;
    if (cleanPhone.length === 11) {
      formattedPhone = `55${cleanPhone}`;
    } else if (cleanPhone.length === 10) {
      formattedPhone = `55${cleanPhone}`;
    }

    console.log("[SEND-WA-PROSPECCAO] Telefone formatado:", formattedPhone);

    // Enviar via Wuzapi
    const wuzapiResponse = await fetch(`${WUZAPI_URL}/chat/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WUZAPI_TOKEN}`
      },
      body: JSON.stringify({
        Phone: formattedPhone,
        Body: message
      })
    });

    const wuzapiResult = await wuzapiResponse.json();
    console.log("[SEND-WA-PROSPECCAO] Resposta Wuzapi:", wuzapiResult);

    // Salvar no banco
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase.from('mensagens_enviadas').insert({
      lead_id: leadId,
      lead_tipo: leadTipo || 'b2c',
      phone: formattedPhone,
      message: message,
      strategy: strategy,
      wuzapi_response: wuzapiResult,
      user_id: userId,
      sent_at: new Date().toISOString()
    });

    // Também salvar em whatsapp_messages para histórico
    await supabase.from('whatsapp_messages').insert({
      user_id: userId,
      phone: formattedPhone,
      direction: 'sent',
      message: message,
      origin: 'prospeccao'
    });

    return new Response(JSON.stringify({
      success: true,
      wuzapi_response: wuzapiResult,
      phone: formattedPhone
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("[SEND-WA-PROSPECCAO] Erro:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
