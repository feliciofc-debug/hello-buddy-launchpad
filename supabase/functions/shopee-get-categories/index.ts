import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHOPEE_API_URL = 'https://open-api.affiliate.shopee.com.br/graphql';
const GRAPHQL_QUERY = `query { productCategoryV2 { nodes { categoryId, categoryName, parentCategoryId } } }`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🏷️ [CATEGORIAS] Iniciando busca de categorias...');
    
    const APP_ID = Deno.env.get('SHOPEE_APP_ID');
    const SECRET_KEY = Deno.env.get('SHOPEE_PARTNER_KEY');

    if (!APP_ID || !SECRET_KEY) {
      throw new Error('Secrets SHOPEE_APP_ID ou SHOPEE_PARTNER_KEY não encontrados.');
    }

    console.log(`🔐 [CATEGORIAS] Credenciais carregadas - App ID: ${APP_ID.substring(0, 8)}...`);

    const timestamp = Math.floor(Date.now() / 1000);
    
    const payload = JSON.stringify({
      query: GRAPHQL_QUERY,
      variables: {},
      operationName: null
    });

    console.log(`🔐 [CATEGORIAS] Timestamp: ${timestamp}`);
    console.log(`🔐 [CATEGORIAS] Payload: ${payload.substring(0, 100)}...`);

    // FORMATO CORRETO DA ASSINATURA: SHA256(appID + timestamp + payload + secret)
    const baseString = `${APP_ID}${timestamp}${payload}${SECRET_KEY}`;
    
    // Gerar SHA256 hash (não HMAC)
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(baseString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log(`🔐 [CATEGORIAS] Assinatura gerada: ${signature.substring(0, 16)}...`);

    // FORMATO CORRETO DO HEADER DE AUTORIZAÇÃO
    const authHeader = `SHA256 Credential=${APP_ID},Timestamp=${timestamp},Signature=${signature}`;
    
    console.log(`🔐 [CATEGORIAS] Auth Header: ${authHeader.substring(0, 70)}...`);
    console.log(`📡 [CATEGORIAS] Enviando requisição para API da Shopee...`);

    const response = await fetch(SHOPEE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: payload,
    });

    console.log(`📥 [CATEGORIAS] Status: ${response.status}`);

    const rawText = await response.text();
    console.log(`📥 [CATEGORIAS] Resposta bruta (primeiros 200 chars): ${rawText.substring(0, 200)}...`);
    
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { rawText };
    }

    if (!response.ok) {
      console.error(`❌ [CATEGORIAS] Erro na API! Status: ${response.status}`);
      console.error(`❌ [CATEGORIAS] Detalhes: ${JSON.stringify(data)}`);
      
      return new Response(JSON.stringify({
        error: 'A API da Shopee retornou um erro.',
        status: response.status,
        details: data,
        diag: {
          url: SHOPEE_API_URL,
          authHeader,
          payload,
          usedAppId: APP_ID,
          usedSecretLen: SECRET_KEY?.length,
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ [CATEGORIAS] Sucesso!`);
    console.log(`📥 [CATEGORIAS] Dados recebidos: ${JSON.stringify(data).substring(0, 200)}...`);

    const categories = data?.data?.productCategoryV2?.nodes || [];
    
    console.log(`📦 [CATEGORIAS] Retornando ${categories.length} categorias`);
    
    return new Response(JSON.stringify({ categories }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error(`💥 [CATEGORIAS] Erro inesperado:`, error);
    return new Response(JSON.stringify({
      error: `Erro inesperado na Edge Function: ${error.message}`,
      stack: error.stack,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
