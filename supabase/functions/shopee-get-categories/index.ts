import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts'

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // As credenciais agora vêm do Deno.env (Secrets da Supabase)
    const APP_ID = Deno.env.get('SHOPEE_APP_ID');
    const SECRET_KEY = Deno.env.get('SHOPEE_PARTNER_KEY');

    if (!APP_ID || !SECRET_KEY) {
      throw new Error('Credenciais da Shopee não configuradas nos Secrets.');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    
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

    // Gera assinatura SHA256
    const payload = JSON.stringify({ query, variables: {} });
    const baseString = `${APP_ID}${timestamp}${payload}${SECRET_KEY}`;
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(baseString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log('🔍 Buscando categorias da Shopee...');

    const authHeader = `SHA256 Credential=${APP_ID},Timestamp=${timestamp},Signature=${signature}`;

    const response = await fetch(SHOPEE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: payload
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na API da Shopee:', response.status, errorText);
      throw new Error(`Erro na API da Shopee: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      console.error('❌ Erro no GraphQL da Shopee:', result.errors);
      throw new Error(`Erro no GraphQL da Shopee: ${JSON.stringify(result.errors)}`);
    }

    const categories = result.data.productCategoryV2.nodes;
    console.log(`✅ ${categories.length} categorias carregadas`);

    return new Response(JSON.stringify({ categories }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('💥 Erro ao buscar categorias:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Erro desconhecido' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})