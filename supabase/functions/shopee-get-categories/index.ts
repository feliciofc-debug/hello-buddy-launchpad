// ARQUIVO SUBSTITUÍDO: supabase/functions/shopee-get-categories/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
// Usando a biblioteca padrão do Deno para HMAC, que é mais estável.
import { HmacSha256 } from "https://deno.land/std@0.119.0/hash/sha256.ts";

const SHOPEE_API_URL = 'https://affiliate-api.shopee.com.br/api/v3/product_category_v2';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), { status: 401, headers: corsHeaders });
    }
    
    const APP_ID = Deno.env.get('SHOPEE_AFFILIATE_APP_ID');
    const SECRET_KEY = Deno.env.get('SHOPEE_AFFILIATE_SECRET');

    if (!APP_ID || !SECRET_KEY) {
      throw new Error('Credenciais da Shopee não configuradas nos Secrets.');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    
    // CORREÇÃO: Usando a implementação HMAC nativa e mais confiável do Deno.
    const sign = new HmacSha256(SECRET_KEY)
      .update(`${APP_ID}${timestamp}`)
      .hex();

    const query = `
      query {
        productCategoryV2 {
          nodes {
            categoryId
            categoryName
            parentCategoryId
          }
        }
      }
    `;

    const requestBody = {
      query,
      variables: {}
    };

    const response = await fetch(SHOPEE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `SHA256-HMAC ${APP_ID},${timestamp},${sign}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro na API da Shopee: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    if (result.errors) {
        throw new Error(`Erro no GraphQL da Shopee: ${JSON.stringify(result.errors)}`);
    }

    const categories = result.data.productCategoryV2.nodes;

    return new Response(JSON.stringify({ categories }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
