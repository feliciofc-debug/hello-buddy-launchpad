import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    console.log('🛒 [SHOPEE-AFFILIATE] Iniciando busca de produtos...');

    const shopeeAppId = Deno.env.get('SHOPEE_APP_ID');
    const shopeePartnerKey = Deno.env.get('SHOPEE_PARTNER_KEY');

    if (!shopeeAppId || !shopeePartnerKey) {
      console.error('❌ [SHOPEE-AFFILIATE] Credenciais não configuradas');
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

    console.log(`✅ [SHOPEE-AFFILIATE] App ID configurado: ${shopeeAppId.substring(0, 8)}...`);

    // Pegar parâmetros da requisição (palavra-chave, limite, etc)
    const { keyword = 'celular', limit = 20 } = await req.json().catch(() => ({}));

    console.log(`🔍 [SHOPEE-AFFILIATE] Buscando produtos com palavra-chave: "${keyword}"`);

    // Query GraphQL para buscar ofertas de produtos
    const graphqlQuery = {
      query: `
        query {
          productOfferV2(
            keyword: "${keyword}"
            limit: ${limit}
          ) {
            nodes {
              productId
              productName
              productLink
              commission
              commissionRate
              price
              sales
              imageUrl
              shopName
              rating
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `
    };

    console.log('📡 [SHOPEE-AFFILIATE] Enviando requisição GraphQL...');

    // Fazer requisição para a API GraphQL da Shopee
    const response = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${shopeeAppId}:${shopeePartnerKey}`
      },
      body: JSON.stringify(graphqlQuery)
    });

    const responseText = await response.text();
    console.log(`📥 [SHOPEE-AFFILIATE] Status da resposta: ${response.status}`);
    console.log(`📥 [SHOPEE-AFFILIATE] Resposta recebida: ${responseText.substring(0, 200)}...`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ [SHOPEE-AFFILIATE] Erro ao fazer parse da resposta:', parseError);
      return new Response(
        JSON.stringify({ 
          status: 'error',
          error: 'Erro ao processar resposta da Shopee',
          rawResponse: responseText 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!response.ok) {
      console.error('❌ [SHOPEE-AFFILIATE] Erro na API da Shopee:', data);
      return new Response(
        JSON.stringify({ 
          status: 'error',
          error: data.errors || 'Erro na API da Shopee',
          details: data
        }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ [SHOPEE-AFFILIATE] Produtos recebidos com sucesso!');
    
    return new Response(
      JSON.stringify({ 
        status: 'success',
        data: data.data,
        message: 'Produtos encontrados com sucesso!'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('💥 [SHOPEE-AFFILIATE] Erro crítico:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error',
        error: error?.message || 'Erro desconhecido',
        stack: error?.stack
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
