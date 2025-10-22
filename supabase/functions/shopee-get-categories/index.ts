// ARQUIVO: supabase/functions/shopee-get-categories/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { HmacSha256 } from "https://deno.land/std@0.119.0/hash/sha256.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHOPEE_API_URL = 'https://affiliate-api.shopee.com.br/api/v3/product_category_v2';
const GRAPHQL_QUERY = `query { productCategoryV2 { nodes { categoryId, categoryName, parentCategoryId } } }`;

// Função para montar o header correto
function buildHeaders(appId: string, secret: string, timestamp: number) {
  const signString = `${appId}${timestamp}`;
  const sign = new HmacSha256(secret).update(signString).hex();
  return {
    'Content-Type': 'application/json',
    'Authorization': `SHA256-HMAC ${appId},${timestamp},${sign}`,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const APP_ID = Deno.env.get('SHOPEE_APP_ID');
    const SECRET_KEY = Deno.env.get('SHOPEE_PARTNER_KEY');

    if (!APP_ID || !SECRET_KEY) {
      throw new Error('Secrets SHOPEE_APP_ID ou SHOPEE_PARTNER_KEY não encontrados.');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const headers = buildHeaders(APP_ID, SECRET_KEY, timestamp);

    const body = {
      query: GRAPHQL_QUERY,
      variables: {}
    };

    const response = await fetch(SHOPEE_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { rawText };
    }

    if (!response.ok) {
      return new Response(JSON.stringify({
        error: 'A API da Shopee retornou um erro.',
        status: response.status,
        details: data,
        diag: {
          url: SHOPEE_API_URL,
          headers,
          body,
          usedAppId: APP_ID,
          usedSecretLen: SECRET_KEY?.length,
          usedSign: headers['Authorization'],
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const categories = data?.data?.productCategoryV2?.nodes || [];
    return new Response(JSON.stringify({ categories }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: `Erro inesperado na Edge Function: ${error.message}`,
      stack: error.stack,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
