import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHOPEE_API_ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql';

// Query simplificada para buscar Hot Products
const GET_HOT_PRODUCTS_QUERY = `query getHotProducts{hotProduct{nodes{productName,price,commissionRate,promotionLink,productImage}}}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🛒 [SHOPEE-AFFILIATE] Iniciando busca com assinatura (Bala de Prata)...');

    const APP_ID = Deno.env.get('SHOPEE_APP_ID');
    const SECRET_KEY = Deno.env.get('SHOPEE_PARTNER_KEY');

    if (!APP_ID || !SECRET_KEY) {
      console.error('❌ [SHOPEE-AFFILIATE] Credenciais não configuradas');
      throw new Error('Credenciais da Shopee não encontradas. Verifique SHOPEE_APP_ID e SHOPEE_PARTNER_KEY.');
    }

    console.log(`✅ [SHOPEE-AFFILIATE] App ID: ${APP_ID.substring(0, 8)}...`);

    const timestamp = Math.floor(Date.now() / 1000);
    
    // LÓGICA DE ASSINATURA SIMPLIFICADA: AppID + Timestamp
    const baseString = `${APP_ID}${timestamp}`;
    
    console.log(`🔐 [SHOPEE-AFFILIATE] Timestamp: ${timestamp}`);
    console.log(`🔐 [SHOPEE-AFFILIATE] Base string: ${baseString}`);
    
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

    // Montar URL com parâmetros de autenticação
    const urlWithParams = new URL(SHOPEE_API_ENDPOINT);
    urlWithParams.searchParams.append('appid', APP_ID);
    urlWithParams.searchParams.append('timestamp', timestamp.toString());
    urlWithParams.searchParams.append('sign', signature);

    console.log(`📡 [SHOPEE-AFFILIATE] URL com params: ${urlWithParams.toString().substring(0, 100)}...`);

    // O corpo da requisição contém apenas a query GraphQL
    const requestBody = {
      query: GET_HOT_PRODUCTS_QUERY,
    };

    console.log('📡 [SHOPEE-AFFILIATE] Enviando requisição com autenticação na URL...');

    const response = await fetch(urlWithParams.toString(), {
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
        searchType: 'hotProducts',
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
