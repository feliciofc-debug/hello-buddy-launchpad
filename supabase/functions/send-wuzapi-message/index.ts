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
    const { phoneNumber, phoneNumbers, message, imageUrl } = await req.json();

    // Suporta tanto phoneNumber (single) quanto phoneNumbers (array)
    const numbersToSend = phoneNumbers || (phoneNumber ? [phoneNumber] : []);

    if (numbersToSend.length === 0 || !message) {
      return new Response(
        JSON.stringify({ error: 'phoneNumber(s) e message são obrigatórios' }),
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

    const baseUrl = WUZAPI_URL.endsWith('/') ? WUZAPI_URL.slice(0, -1) : WUZAPI_URL;
    
    // Enviar para todos os números
    const results = [];
    
    for (const phoneNumber of numbersToSend) {
      try {
        // Formatar o número no padrão internacional (apenas dígitos)
        let formattedPhone = phoneNumber.replace(/\D/g, '');
        
        // Adiciona código do país +55 se não tiver
        if (!formattedPhone.startsWith('55') && formattedPhone.length === 11) {
          formattedPhone = '55' + formattedPhone;
        }

        // Escolhe endpoint baseado se tem imagem ou não
        const endpoint = imageUrl ? '/chat/send/image' : '/chat/send/text';
        
        console.log('🚀 Enviando para:', formattedPhone, imageUrl ? '(com imagem)' : '(só texto)');

        // Payload varia conforme tipo de mensagem
        const payload = imageUrl 
          ? {
              Phone: formattedPhone,
              Body: message || '',
              Media: imageUrl,
              Caption: message || ''
            }
          : {
              Phone: formattedPhone,
              Body: message
            };
        
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Token': WUZAPI_TOKEN,
          },
          body: JSON.stringify(payload),
        });

        const responseText = await response.text();
        
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (e) {
          responseData = { rawResponse: responseText };
        }

        results.push({
          phoneNumber: formattedPhone,
          success: response.ok,
          data: responseData
        });

        console.log(`✅ Enviado para ${formattedPhone}:`, response.status);

      } catch (error) {
        console.error(`❌ Erro ao enviar para ${phoneNumber}:`, error);
        results.push({
          phoneNumber,
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
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
