import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHOPEE_API_ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql';

// Query correta que suporta filtro por categoria
const GET_PRODUCTS_QUERY = `
  query GetProducts($page: Int, $limit: Int, $categoryId: Int64, $keyword: String) {
    productOfferV2(
      page: $page,
      limit: $limit,
      categoryId: $categoryId,
      keyword: $keyword,
      sortType: 2
    ) {
      nodes {
        commissionRate
        commission
        price
        productLink
        offerLink
        productName
        imageUrl
      }
      pageInfo {
        page
        limit
        hasNextPage
      }
    }
  }
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Tratamento defensivo do body da requisição
    let pageSize = 50; // Valor padrão
    let keywords = null;
    let categoryId = null;
    
    console.log('📨 [SHOPEE-AFFILIATE] Requisição recebida');
    
    try {
      const body = await req.json();
      console.log('📦 [SHOPEE-AFFILIATE] Body recebido:', JSON.stringify(body));
      
      if (body && body.pageSize) {
        // CRÍTICO: A API da Shopee tem limite máximo de 50 produtos por requisição
        pageSize = Math.min(body.pageSize, 50);
        console.log(`⚠️ [SHOPEE-AFFILIATE] pageSize ajustado de ${body.pageSize} para ${pageSize} (máximo permitido pela API)`);
      }
      if (body && body.keywords) {
        keywords = body.keywords;
        console.log(`🔍 [SHOPEE-AFFILIATE] Filtrando por palavra-chave: ${keywords}`);
      }
      if (body && body.categoryId) {
        categoryId = body.categoryId;
        console.log(`🏷️ [SHOPEE-AFFILIATE] Filtrando por categoria ID: ${categoryId}`);
      }
    } catch (e) {
      console.warn('⚠️ [SHOPEE-AFFILIATE] Requisição sem body, usando valores padrão');
    }
    
    console.log(`🛒 [SHOPEE-AFFILIATE] Iniciando busca...${keywords ? ` Palavra-chave: "${keywords}"` : ''}${categoryId ? ` Categoria: ${categoryId}` : ''}`);
    console.log(`📊 [SHOPEE-AFFILIATE] Quantidade solicitada: ${pageSize} produtos`);

    const APP_ID = Deno.env.get('SHOPEE_APP_ID');
    const SECRET_KEY = Deno.env.get('SHOPEE_PARTNER_KEY');

    if (!APP_ID || !SECRET_KEY) {
      console.error('❌ [SHOPEE-AFFILIATE] Credenciais não configuradas');
      throw new Error('Credenciais da Shopee não encontradas. Verifique SHOPEE_APP_ID e SHOPEE_PARTNER_KEY.');
    }

    console.log(`✅ [SHOPEE-AFFILIATE] Credenciais carregadas - App ID: ${APP_ID.substring(0, 8)}...`);

    const timestamp = Math.floor(Date.now() / 1000);
    
    // Monta as variáveis da query
    const variables: any = { 
      page: 0, 
      limit: pageSize
    };
    
    // Adiciona categoria se fornecida
    if (categoryId) {
      variables.categoryId = parseInt(categoryId);
      console.log(`🏷️ [SHOPEE-AFFILIATE] Aplicando filtro de categoria: ${variables.categoryId}`);
    }
    
    // Adiciona palavra-chave se fornecida
    if (keywords) {
      variables.keyword = keywords;
      console.log(`🔍 [SHOPEE-AFFILIATE] Aplicando filtro de palavra-chave: "${keywords}"`);
    }
    
    const query = GET_PRODUCTS_QUERY;
    
    // O corpo da requisição GraphQL com variáveis
    const payload = JSON.stringify({
      query,
      variables,
      operationName: null
    });

    // FORMATO CORRETO DA ASSINATURA: SHA256(appID + timestamp + payload + secret)
    const baseString = `${APP_ID}${timestamp}${payload}${SECRET_KEY}`;
    
    console.log(`🔐 [SHOPEE-AFFILIATE] Timestamp: ${timestamp}`);
    console.log(`🔐 [SHOPEE-AFFILIATE] Payload: ${payload.substring(0, 100)}...`);
    
    // Gerar SHA256 hash (não HMAC)
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(baseString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log(`🔐 [SHOPEE-AFFILIATE] Assinatura gerada: ${signature.substring(0, 16)}...`);

    // FORMATO CORRETO DO HEADER DE AUTORIZAÇÃO
    const authHeader = `SHA256 Credential=${APP_ID},Timestamp=${timestamp},Signature=${signature}`;
    
    console.log(`🔐 [SHOPEE-AFFILIATE] Auth Header: ${authHeader.substring(0, 80)}...`);
    console.log('📡 [SHOPEE-AFFILIATE] Enviando requisição com header correto...');

    const response = await fetch(SHOPEE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: payload,
    });

    const responseText = await response.text();
    console.log(`📥 [SHOPEE-AFFILIATE] Status: ${response.status}`);
    console.log(`📥 [SHOPEE-AFFILIATE] Resposta:`, responseText);

    if (!response.ok) {
      console.error('❌ [SHOPEE-AFFILIATE] Erro HTTP:', responseText);
      throw new Error(`Erro na API da Shopee: ${response.status} ${response.statusText} - ${responseText}`);
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ [SHOPEE-AFFILIATE] Erro ao fazer parse:', parseError);
      throw new Error(`Erro ao processar resposta: ${responseText}`);
    }

    // Verificar erros GraphQL
    if (responseData.errors && responseData.errors.length > 0) {
      console.error('❌ [SHOPEE-AFFILIATE] Erros GraphQL:', JSON.stringify(responseData.errors));
      return new Response(
        JSON.stringify({ 
          status: 'error',
          error: 'Erro GraphQL da Shopee',
          graphqlErrors: responseData.errors,
          fullResponse: responseData
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ [SHOPEE-AFFILIATE] Sucesso!');
    
    // Pegar os produtos da resposta
    let products = responseData.data?.productOfferV2?.nodes || [];
    
    console.log(`📦 [SHOPEE-AFFILIATE] ${products.length} produtos recebidos da API`);
    console.log(`✅ [SHOPEE-AFFILIATE] Filtros aplicados com sucesso!`);

    console.log('📦 [SHOPEE-AFFILIATE] Retornando', products.length, 'produtos');

    return new Response(
      JSON.stringify({ 
        status: 'success',
        data: { productOfferV2: { nodes: products } },
        message: `${products.length} produtos encontrados${keywords ? ` para "${keywords}"` : ''}${categoryId ? ` na categoria ${categoryId}` : ''}`,
        filters: {
          keyword: keywords || null,
          categoryId: categoryId || null,
          pageSize
        }
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
