import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

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
    console.log('🛒 [SHOPEE-AFFILIATE] Iniciando busca com assinatura HMAC...');

    const APP_ID = Deno.env.get('SHOPEE_APP_ID');
    const SECRET_KEY = Deno.env.get('SHOPEE_PARTNER_KEY');

    if (!APP_ID || !SECRET_KEY) {
      console.error('❌ [SHOPEE-AFFILIATE] Credenciais não configuradas');
      throw new Error('Credenciais da Shopee não encontradas. Verifique SHOPEE_APP_ID e SHOPEE_PARTNER_KEY.');
    }

    console.log(`✅ [SHOPEE-AFFILIATE] App ID: ${APP_ID.substring(0, 8)}...`);

    // Pegar parâmetros da requisição
    const { keyword, limit, pageNo = 1, pageSize = 10 } = await req.json().catch(() => ({}));

    // Decide qual query usar
    const useSearch = !!keyword;
    const query = useSearch ? SEARCH_PRODUCTS_QUERY : GET_HOT_PRODUCTS_QUERY;
    const variables = useSearch 
      ? { keyword, limit: limit || 10 }
      : { pageNo, pageSize };

    console.log(`📋 [SHOPEE-AFFILIATE] Tipo: ${useSearch ? 'BUSCA' : 'HOT PRODUCTS'}`);

    // Gerar assinatura HMAC-SHA256
    const timestamp = Math.floor(Date.now() / 1000);
    const queryForSignature = query.replace(/\s+/g, ' ').trim(); // Normaliza espaços
    const baseString = `${APP_ID}${timestamp}${queryForSignature}`;
    
    console.log(`🔐 [SHOPEE-AFFILIATE] Timestamp: ${timestamp}`);
    console.log(`🔐 [SHOPEE-AFFILIATE] Base string (primeiros 100 chars): ${baseString.substring(0, 100)}...`);
    
    // Usar Web Crypto API para gerar HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(SECRET_KEY);
    const messageData = encoder.encode(baseString);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signature = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log(`🔐 [SHOPEE-AFFILIATE] Assinatura gerada: ${signature.substring(0, 16)}...`);

    // Montar requisição com assinatura
    const requestBody = {
      query,
      variables,
      appid: parseInt(APP_ID, 10),
      timestamp: timestamp,
      sign: signature // Campo 'sign' para a assinatura
    };

    console.log('📡 [SHOPEE-AFFILIATE] Enviando requisição com assinatura...');

    const response = await fetch(SHOPEE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log(`📥 [SHOPEE-AFFILIATE] Status: ${response.status}`);
    console.log(`📥 [SHOPEE-AFFILIATE] Resposta:`, responseText);

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

    // Verificar erros GraphQL
    if (data.errors && data.errors.length > 0) {
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

    console.log('✅ [SHOPEE-AFFILIATE] Sucesso com assinatura HMAC!');
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
