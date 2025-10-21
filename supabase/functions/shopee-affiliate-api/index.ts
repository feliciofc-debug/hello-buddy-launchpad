import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Query GraphQL para buscar "Hot Products" (produtos em destaque)
const GET_HOT_PRODUCTS_QUERY = `
  query getHotProducts($pageNo: Int, $pageSize: Int) {
    hotProduct(pageNo: $pageNo, pageSize: $pageSize) {
      nodes {
        productName
        price
        commissionRate
        promotionLink
        productImage
      }
      pageInfo {
        pageNo
        pageSize
        total
      }
    }
  }
`;

// Query alternativa para buscar por palavra-chave
const SEARCH_PRODUCTS_QUERY = `
  query searchProducts($keyword: String!, $limit: Int) {
    productOfferV2(keyword: $keyword, limit: $limit) {
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
`;

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
          error: 'Credenciais da Shopee não configuradas. Verifique SHOPEE_APP_ID e SHOPEE_PARTNER_KEY.' 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`✅ [SHOPEE-AFFILIATE] App ID: ${shopeeAppId.substring(0, 8)}...`);

    // Pegar parâmetros da requisição
    const { keyword, limit, pageNo = 1, pageSize = 10 } = await req.json().catch(() => ({}));

    // Decide qual query usar: se tiver keyword, usa busca; senão, usa hot products
    const useSearch = !!keyword;
    const query = useSearch ? SEARCH_PRODUCTS_QUERY : GET_HOT_PRODUCTS_QUERY;
    const variables = useSearch 
      ? { keyword, limit: limit || 10 }
      : { pageNo, pageSize };

    console.log(`📋 [SHOPEE-AFFILIATE] Tipo de busca: ${useSearch ? 'BUSCA POR PALAVRA-CHAVE' : 'HOT PRODUCTS'}`);
    console.log(`📋 [SHOPEE-AFFILIATE] Variáveis:`, JSON.stringify(variables));

    // Montar requisição GraphQL
    const graphqlRequest = {
      query,
      variables
    };

    console.log('📡 [SHOPEE-AFFILIATE] Enviando requisição GraphQL...');
    console.log('📡 [SHOPEE-AFFILIATE] Query:', query.substring(0, 100) + '...');

    // Fazer requisição para a API GraphQL da Shopee
    const response = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${shopeeAppId}:${shopeePartnerKey}`
      },
      body: JSON.stringify(graphqlRequest)
    });

    const responseText = await response.text();
    console.log(`📥 [SHOPEE-AFFILIATE] Status da resposta: ${response.status}`);
    console.log(`📥 [SHOPEE-AFFILIATE] Resposta completa:`, responseText);

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
      console.error('❌ [SHOPEE-AFFILIATE] Erro HTTP na API da Shopee:', data);
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

    // Verificar se há erros no GraphQL
    if (data.errors) {
      console.error('❌ [SHOPEE-AFFILIATE] Erros GraphQL:', JSON.stringify(data.errors));
      return new Response(
        JSON.stringify({ 
          status: 'error',
          error: 'Erro GraphQL da Shopee',
          graphqlErrors: data.errors,
          fullResponse: data
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ [SHOPEE-AFFILIATE] Resposta recebida com sucesso!');
    console.log('📦 [SHOPEE-AFFILIATE] Dados:', JSON.stringify(data, null, 2));
    
    // Retornar a resposta COMPLETA para análise
    return new Response(
      JSON.stringify({ 
        status: 'success',
        data: data.data,
        fullResponse: data,
        searchType: useSearch ? 'keyword' : 'hotProducts',
        message: 'Resposta da Shopee recebida com sucesso!'
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
