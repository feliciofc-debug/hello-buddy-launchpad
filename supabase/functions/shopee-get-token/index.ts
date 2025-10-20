import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, shop_id } = await req.json();
    
    if (!code || !shop_id) {
      return new Response(
        JSON.stringify({ 
          status: 'error',
          error: 'Código de autorização e shop_id são obrigatórios' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('🔐 [SHOPEE-TOKEN] Trocando código por access_token...');
    console.log(`📍 [SHOPEE-TOKEN] Shop ID: ${shop_id}`);

    const partnerId = Deno.env.get('SHOPEE_APP_ID');
    const partnerKey = Deno.env.get('SHOPEE_PARTNER_KEY');

    if (!partnerId || !partnerKey) {
      console.error('❌ [SHOPEE-TOKEN] Credenciais não configuradas');
      return new Response(
        JSON.stringify({ 
          status: 'error',
          error: 'Credenciais da Shopee não configuradas' 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Gerar signature para obter token
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/auth/token/get';
    const baseString = `${partnerId}${path}${timestamp}`;
    
    const sign = createHmac('sha256', partnerKey)
      .update(baseString)
      .digest('hex');
    
    console.log(`📡 [SHOPEE-TOKEN] Chamando API para obter token...`);

    const tokenUrl = `https://partner.shopeemobile.com${path}`;
    const params = new URLSearchParams({
      partner_id: partnerId,
      timestamp: timestamp.toString(),
      sign: sign
    });

    const response = await fetch(`${tokenUrl}?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: code,
        shop_id: parseInt(shop_id),
        partner_id: parseInt(partnerId)
      })
    });

    console.log(`📡 [SHOPEE-TOKEN] Status da resposta: ${response.status}`);
    
    const responseText = await response.text();
    console.log(`📡 [SHOPEE-TOKEN] Resposta: ${responseText}`);

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { 
          raw_response: responseText,
          status: response.status,
          statusText: response.statusText
        };
      }
      
      console.error('❌ [SHOPEE-TOKEN] Erro na obtenção do token:', errorData);
      
      return new Response(
        JSON.stringify({ 
          status: 'error',
          error: 'Erro ao obter token da Shopee',
          details: errorData
        }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    let tokenData;
    try {
      tokenData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ [SHOPEE-TOKEN] Erro ao parsear JSON:', parseError);
      return new Response(
        JSON.stringify({ 
          status: 'error',
          error: 'Resposta inválida da API Shopee',
          details: { raw_response: responseText }
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (tokenData.error) {
      console.error('❌ [SHOPEE-TOKEN] Erro retornado pela API:', tokenData.message);
      return new Response(
        JSON.stringify({ 
          status: 'error',
          error: tokenData.message || 'Erro desconhecido da API Shopee'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ [SHOPEE-TOKEN] Token obtido com sucesso!');
    
    return new Response(
      JSON.stringify({ 
        status: 'success',
        message: 'Token da Shopee obtido com sucesso!',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expire_in: tokenData.expire_in,
        shop_id: shop_id
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('💥 [SHOPEE-TOKEN] Erro crítico:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error',
        error: error?.message || 'Erro desconhecido' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
