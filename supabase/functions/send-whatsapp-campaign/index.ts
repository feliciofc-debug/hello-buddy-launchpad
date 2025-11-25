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
    const { phoneNumbers, message, imageUrl } = await req.json();

    if (!phoneNumbers || phoneNumbers.length === 0 || !message) {
      return new Response(
        JSON.stringify({ error: 'phoneNumbers e message são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const WUZAPI_URL = Deno.env.get('WUZAPI_URL');
    const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN');

    if (!WUZAPI_URL || !WUZAPI_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'Credenciais Wuzapi não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = WUZAPI_URL.endsWith('/') ? WUZAPI_URL.slice(0, -1) : WUZAPI_URL;
    const results = [];
    
    for (const phoneNumber of phoneNumbers) {
      try {
        let formattedPhone = phoneNumber.replace(/\D/g, '');
        
        if (!formattedPhone.startsWith('55') && formattedPhone.length === 11) {
          formattedPhone = '55' + formattedPhone;
        }

        const endpoint = imageUrl ? '/chat/send/image' : '/chat/send/text';
        
        const payload = imageUrl 
          ? { Phone: formattedPhone, Body: message, Media: imageUrl }
          : { Phone: formattedPhone, Body: message };
        
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
        } catch {
          responseData = { rawResponse: responseText };
        }

        results.push({
          phoneNumber: formattedPhone,
          success: response.ok,
          data: responseData
        });

        console.log(`${response.ok ? '✅' : '❌'} ${formattedPhone}`);

      } catch (error) {
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
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
