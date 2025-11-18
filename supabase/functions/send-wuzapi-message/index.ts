import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, message } = await req.json();

    if (!phoneNumber || !message) {
      return new Response(
        JSON.stringify({ error: 'phoneNumber e message são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const WUZAPI_URL = Deno.env.get('WUZAPI_URL');
    const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN');
    const WUZAPI_INSTANCE_ID = Deno.env.get('WUZAPI_INSTANCE_ID');

    if (!WUZAPI_URL || !WUZAPI_TOKEN || !WUZAPI_INSTANCE_ID) {
      console.error('Credenciais Wuzapi não configuradas');
      return new Response(
        JSON.stringify({ error: 'Credenciais Wuzapi não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Formatar o número no padrão internacional
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    const chatId = `${formattedPhone}@s.whatsapp.net`;

    console.log('Enviando mensagem para:', chatId);

    console.log('URL completa:', `${WUZAPI_URL}/chat/send/text`);
    console.log('Payload:', { session: WUZAPI_INSTANCE_ID, to: chatId, text: message });

    const response = await fetch(`${WUZAPI_URL}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': WUZAPI_TOKEN,
      },
      body: JSON.stringify({
        sessionId: WUZAPI_INSTANCE_ID,
        to: chatId,
        message: message
      }),
    });

    const responseText = await response.text();
    console.log('Resposta Wuzapi (texto):', responseText);
    console.log('Status:', response.status);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.error('Erro ao fazer parse do JSON:', e);
      responseData = { rawResponse: responseText };
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'Erro ao enviar mensagem', details: responseData }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: responseData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função send-wuzapi-message:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
