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
    const { phoneNumber, phoneNumbers, message, imageUrl, groupId, action } = await req.json();

    // Se for ação de listar grupos, não valida phoneNumber/message
    if (action === 'list-groups') {
      const WUZAPI_URL = Deno.env.get('WUZAPI_URL');
      const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN');

      if (!WUZAPI_URL || !WUZAPI_TOKEN) {
        return new Response(
          JSON.stringify({ error: 'Credenciais Wuzapi não configuradas' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const baseUrl = WUZAPI_URL.endsWith('/') ? WUZAPI_URL.slice(0, -1) : WUZAPI_URL;
      
      console.log('📋 Listando grupos do WhatsApp...');
      
      const response = await fetch(`${baseUrl}/groups`, {
        method: 'GET',
        headers: {
          'Token': WUZAPI_TOKEN,
        },
      });

      const responseText = await response.text();
      console.log('📋 Resposta bruta:', responseText);
      console.log('📋 Status:', response.status);

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.error('❌ Erro ao parsear resposta:', e);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Resposta inválida da API Wuzapi',
            rawResponse: responseText 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('📋 Grupos encontrados:', responseData);

      return new Response(
        JSON.stringify({ success: true, groups: responseData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Suporta tanto phoneNumber (single) quanto phoneNumbers (array)
    const numbersToSend = phoneNumbers || (phoneNumber ? [phoneNumber] : []);

    // ⚠️ NOVA LÓGICA ADITIVA: Aceita groupId também
    if (numbersToSend.length === 0 && !groupId) {
      return new Response(
        JSON.stringify({ error: 'phoneNumber(s) ou groupId são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'message é obrigatório' }),
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
    
    // ⚠️ NOVA LÓGICA ADITIVA: Se for groupId, usar endpoint de grupo
    if (groupId) {
      try {
        console.log('👥 Enviando para grupo:', groupId, imageUrl ? '(com imagem)' : '(só texto)');

        const endpoint = imageUrl ? '/send-group-media' : '/send-group-message';
        
        const payload = imageUrl 
          ? {
              group: groupId,
              image: imageUrl,
              caption: message || ''
            }
          : {
              group: groupId,
              message: message
            };

        console.log('📋 Payload grupo:', JSON.stringify(payload, null, 2));

        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Token': WUZAPI_TOKEN,
          },
          body: JSON.stringify(payload),
        });

        const responseText = await response.text();
        console.log(`📨 Status grupo:`, response.status);
        console.log(`📨 Resposta grupo:`, responseText);
        
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (e) {
          responseData = { rawResponse: responseText };
        }

        return new Response(
          JSON.stringify({ 
            success: response.ok, 
            groupId,
            type: 'group',
            data: responseData 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (error) {
        console.error(`❌ Erro ao enviar para grupo ${groupId}:`, error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            groupId,
            type: 'group',
            error: error instanceof Error ? error.message : 'Erro desconhecido' 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // ⚠️ LÓGICA ORIGINAL: Enviar para contatos individuais (NÃO MODIFICADA)
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
              Image: imageUrl,
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
        
        console.log(`📋 Payload enviado:`, JSON.stringify(payload, null, 2));
        console.log(`📨 Status:`, response.status);
        console.log(`📨 Resposta completa:`, responseText);
        
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
