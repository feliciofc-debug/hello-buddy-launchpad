import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHOPEE_API_ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql';

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
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🛒 [SHOPEE-AFFILIATE] Iniciando busca de produtos...');

    const APP_ID = Deno.env.get('SHOPEE_APP_ID');
    const SECRET_KEY = Deno.env.get('SHOPEE_PARTNER_KEY');

    if (!APP_ID || !SECRET_KEY) {
      console.error('❌ [SHOPEE-AFFILIATE] Credenciais não configuradas');
      throw new Error('Credenciais da Shopee não encontradas. Verifique SHOPEE_APP_ID e SHOPEE_PARTNER_KEY.');
    }

    console.log(`✅ [SHOPEE-AFFILIATE] App ID: ${APP_ID.substring(0, 8)}...`);

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

    // NOVA ABORDAGEM: Credenciais no corpo da requisição
    const requestBody = {
      query,
      variables,
      // Credenciais enviadas no corpo (appid como número)
      appid: parseInt(APP_ID, 10),
      secret: SECRET_KEY
    };

    console.log('📡 [SHOPEE-AFFILIATE] Enviando requisição (credenciais no body)...');

    // Fazer requisição SEM autenticação no header
    const response = await fetch(SHOPEE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log(`📥 [SHOPEE-AFFILIATE] Status: ${response.status}`);
    console.log(`📥 [SHOPEE-AFFILIATE] Resposta completa:`, responseText);

    if (!response.ok) {
      console.error('❌ [SHOPEE-AFFILIATE] Erro HTTP:', responseText);
      throw new Error(`Erro na API da Shopee: ${response.status} ${response.statusText} - ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ [SHOPEE-AFFILIATE] Erro ao fazer parse:', parseError);
      throw new Error(`Erro ao processar resposta: ${responseText}`);
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

    console.log('✅ [SHOPEE-AFFILIATE] Sucesso!');
    console.log('📦 [SHOPEE-AFFILIATE] Dados:', JSON.stringify(data, null, 2));

    return new Response(
      JSON.stringify({ 
        status: 'success',
        data: data.data,
        fullResponse: data,
        searchType: useSearch ? 'keyword' : 'hotProducts',
        message: 'Produtos da Shopee carregados com sucesso!'
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
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
