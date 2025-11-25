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
    const { userId } = await req.json();

    console.log('🔄 Iniciando sincronização de grupos para:', userId);

    const WUZAPI_URL = Deno.env.get('WUZAPI_URL');
    const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN');

    if (!WUZAPI_URL || !WUZAPI_TOKEN) {
      throw new Error('Credenciais Wuzapi não configuradas');
    }

    const baseUrl = WUZAPI_URL.endsWith('/') ? WUZAPI_URL.slice(0, -1) : WUZAPI_URL;

    let groups = [];
    let successEndpoint = '';
    
    // TENTATIVA 1: Endpoint /chats (mais comum em Wuzapi)
    try {
      successEndpoint = `${baseUrl}/chats`;
      console.log('🔍 Tentando endpoint:', successEndpoint);
      
      const response = await fetch(successEndpoint, {
        method: 'GET',
        headers: {
          'Token': WUZAPI_TOKEN,
          'Accept': 'application/json'
        }
      });

      console.log('📡 Status:', response.status);
      console.log('📄 Content-Type:', response.headers.get('content-type'));

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Status ${response.status}: ${errorText}`);
      }

      const text = await response.text();
      console.log('📝 Resposta (primeiros 500 chars):', text.substring(0, 500));

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('❌ Resposta não é JSON válido');
        throw new Error('Resposta da API não é JSON válido');
      }

      console.log('✅ Dados parseados com sucesso');

      // Filtrar apenas grupos (ID termina com @g.us)
      if (Array.isArray(data)) {
        groups = data.filter((chat: any) => 
          chat.id?.endsWith('@g.us') || 
          chat.isGroup === true ||
          chat.type === 'group'
        );
      } else if (data.chats && Array.isArray(data.chats)) {
        groups = data.chats.filter((chat: any) => 
          chat.id?.endsWith('@g.us') || 
          chat.isGroup === true ||
          chat.type === 'group'
        );
      }

      console.log(`📊 ${groups.length} grupos encontrados no /chats`);

    } catch (error1: any) {
      console.log('❌ /chats falhou:', error1?.message || error1);
      
      // TENTATIVA 2: Endpoint /groups
      try {
        successEndpoint = `${baseUrl}/groups`;
        console.log('🔍 Tentando endpoint alternativo:', successEndpoint);
        
        const response2 = await fetch(successEndpoint, {
          method: 'GET',
          headers: {
            'Token': WUZAPI_TOKEN,
            'Accept': 'application/json'
          }
        });

        console.log('📡 Status /groups:', response2.status);

        if (response2.ok) {
          const text2 = await response2.text();
          console.log('📝 Resposta /groups:', text2.substring(0, 500));
          
          const data2 = JSON.parse(text2);
          groups = Array.isArray(data2) ? data2 : (data2.groups || []);
          console.log(`📊 ${groups.length} grupos encontrados no /groups`);
        }
      } catch (error2: any) {
        console.error('❌ /groups também falhou:', error2?.message || error2);
        
        // TENTATIVA 3: Endpoint /list-groups
        try {
          successEndpoint = `${baseUrl}/list-groups`;
          console.log('🔍 Última tentativa:', successEndpoint);
          
          const response3 = await fetch(successEndpoint, {
            method: 'GET',
            headers: {
              'Token': WUZAPI_TOKEN,
              'Accept': 'application/json'
            }
          });

          if (response3.ok) {
            const text3 = await response3.text();
            const data3 = JSON.parse(text3);
            groups = Array.isArray(data3) ? data3 : (data3.groups || []);
            console.log(`📊 ${groups.length} grupos encontrados no /list-groups`);
          }
        } catch (error3) {
          console.error('❌ Todos os endpoints falharam');
        }
      }
    }

    // Se não encontrou grupos, retornar erro informativo
    if (groups.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Nenhum grupo encontrado. Verifique se:\n1. O WhatsApp está conectado ao Wuzapi\n2. Você participa de grupos no WhatsApp\n3. As credenciais Wuzapi estão corretas',
          debug: {
            triedEndpoints: [
              `${baseUrl}/chats`,
              `${baseUrl}/groups`,
              `${baseUrl}/list-groups`
            ],
            wuzapiUrl: baseUrl
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Preparar dados para inserir
    const groupsToInsert = groups.map((group: any) => ({
      user_id: userId,
      group_id: group.id || group.jid || group.groupId || 'unknown',
      group_name: group.name || group.subject || group.groupName || 'Grupo sem nome',
      member_count: group.size || group.participants?.length || 0,
      status: 'active'
    }));

    console.log('💾 Salvando grupos no banco:', groupsToInsert.length);

    // Salvar no Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Usar upsert para evitar duplicatas
    const { error: upsertError } = await supabaseAdmin
      .from('whatsapp_groups')
      .upsert(groupsToInsert, { 
        onConflict: 'user_id,group_id',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      console.error('❌ Erro ao salvar grupos:', upsertError);
      throw upsertError;
    }

    console.log(`✅ ${groups.length} grupos sincronizados com sucesso!`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        groupsCount: groups.length,
        groups: groupsToInsert,
        endpoint: successEndpoint
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('❌ Erro geral:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Erro desconhecido',
        details: error.stack
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
