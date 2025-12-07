import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📥 send-wuzapi-message iniciado');
    
    // Criar cliente Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Pegar usuário autenticado
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (!userError && user) {
        userId = user.id;
        console.log('👤 User ID:', userId);
      }
    }
    
    const { phoneNumber, phoneNumbers, message, imageUrl, groupId, action, userId: bodyUserId } = await req.json();
    
    // Usar userId do body se não tiver do header (para chamadas internas)
    if (!userId && bodyUserId) {
      userId = bodyUserId;
      console.log('👤 User ID (do body):', userId);
    }

    // 🔥 BUSCAR INSTÂNCIA DO USUÁRIO
    let instance: any = null;
    
    if (userId) {
      const { data: userInstance, error: instanceError } = await supabase
        .from('wuzapi_instances')
        .select('*')
        .eq('assigned_to_user', userId)
        .single();
      
      if (!instanceError && userInstance) {
        instance = userInstance;
        console.log('📡 Instância do usuário encontrada:', instance.instance_name);
      }
    }
    
    // Se não encontrou instância do usuário, buscar primeira disponível conectada
    if (!instance) {
      const { data: anyInstance, error: anyError } = await supabase
        .from('wuzapi_instances')
        .select('*')
        .eq('is_connected', true)
        .limit(1)
        .single();
      
      if (!anyError && anyInstance) {
        instance = anyInstance;
        console.log('📡 Usando instância disponível:', instance.instance_name);
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
    const wuzapiToken = instance.wuzapi_token;
    
    console.log('🌐 URL:', wuzapiUrl);
    console.log('🔑 Token:', wuzapiToken.substring(0, 10) + '...');
    console.log('📍 Instância:', instance.instance_name);
    
    const baseUrl = wuzapiUrl.endsWith('/') ? wuzapiUrl.slice(0, -1) : wuzapiUrl;

    // Se for ação de listar grupos
    if (action === 'list-groups') {
      console.log('📋 Listando grupos do WhatsApp...');
      
      const response = await fetch(`${baseUrl}/groups`, {
        method: 'GET',
        headers: {
          'Token': wuzapiToken,
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

    // Aceita groupId também
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
    
    // Se for groupId, usar endpoint de grupo
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
            'Token': wuzapiToken,
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
            instance: instance.instance_name,
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
    
    // Enviar para contatos individuais
    const results = [];
    
    for (const phone of numbersToSend) {
      try {
        // Formatar o número no padrão internacional (apenas dígitos)
        let formattedPhone = phone.replace(/\D/g, '');
        
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
            'Token': wuzapiToken,
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
          instance: instance.instance_name,
          data: responseData
        });

        console.log(`✅ Enviado para ${formattedPhone}:`, response.status);

      } catch (error) {
        console.error(`❌ Erro ao enviar para ${phone}:`, error);
        results.push({
          phoneNumber: phone,
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    console.log('✅ Envio concluído! Total:', results.length, 'mensagens');

    return new Response(
      JSON.stringify({ success: true, instance: instance.instance_name, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Erro na função send-wuzapi-message:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
