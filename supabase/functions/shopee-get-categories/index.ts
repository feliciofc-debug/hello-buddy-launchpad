// ARQUIVO SUBSTITUÍDO: supabase/functions/shopee-get-categories/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { HmacSha256 } from "https://deno.land/std@0.119.0/hash/sha256.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SHOPEE_API_URL = 'https://affiliate-api.shopee.com.br/api/v3/product_category_v2';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const APP_ID = Deno.env.get('SHOPEE_APP_ID');
    const SECRET_KEY = Deno.env.get('SHOPEE_PARTNER_KEY');

    if (!APP_ID || !SECRET_KEY) {
      throw new Error('Secrets SHOPEE_APP_ID ou SHOPEE_PARTNER_KEY não encontrados.');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const sign = new HmacSha256(SECRET_KEY).update(`${APP_ID}${timestamp}`).hex();

    const query = `query { productCategoryV2 { nodes { categoryId, categoryName, parentCategoryId } } }`;
    const requestBody = { query, variables: {} };

    let response;
    let responseBody;
    let responseStatus;

    try {
      response = await fetch(SHOPEE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `SHA256-HMAC ${APP_ID},${timestamp},${sign}`
        },
        body: JSON.stringify(requestBody)
      });
      responseStatus = response.status;
      responseBody = await response.json();

    } catch (fetchError: any) {
      // Se o próprio fetch falhar, o erro é de rede ou DNS.
      throw new Error(`Erro no fetch: ${fetchError.message}`);
    }

    // Se a resposta NÃO for OK, vamos retornar o corpo do erro que a Shopee enviou
    if (!response.ok) {
      // O objetivo é retornar ESTA MENSAGEM para o frontend, em vez de quebrar a função.
      return new Response(JSON.stringify({ 
        error: 'A API da Shopee retornou um erro.',
        shopee_status: responseStatus,
        shopee_response: responseBody 
      }), {
        status: 400, // Retornamos um erro "controlado"
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const categories = responseBody.data.productCategoryV2.nodes;

    return new Response(JSON.stringify({ categories }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    // Este catch agora pega erros de configuração (secrets) ou do fetch em si.
    return new Response(JSON.stringify({ error: `Erro inesperado na Edge Function: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
