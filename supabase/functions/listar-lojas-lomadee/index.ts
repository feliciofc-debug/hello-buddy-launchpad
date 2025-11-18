import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appToken } = await req.json();

    if (!appToken) {
      throw new Error('APP_TOKEN da Lomadee é obrigatório');
    }

    console.log('[LOMADEE-STORES] Buscando lojas aprovadas...');

    // Chamar API da Lomadee para listar brands/lojas
    const lomadeeUrl = 'https://api-beta.lomadee.com.br/affiliate/brands';
    
    console.log('[LOMADEE-STORES] URL:', lomadeeUrl);

    const response = await fetch(lomadeeUrl, {
      method: 'GET',
      headers: {
        'x-api-key': appToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LOMADEE-STORES] Erro na API:', response.status, errorText);
      throw new Error(`Erro ao buscar lojas: ${response.status}`);
    }

    const data = await response.json();
    console.log('[LOMADEE-STORES] Resposta completa:', JSON.stringify(data).substring(0, 500));

    // Extrair lojas dos brands
    const stores: any[] = [];

    // A resposta pode ser um objeto com data.data ou direto um array
    const brandsArray = data.data || data;

    if (Array.isArray(brandsArray)) {
      console.log(`[LOMADEE-STORES] Encontrados ${brandsArray.length} brands`);
      
      brandsArray.forEach((brand: any) => {
        // Pode vir como { data: {...} } ou direto {...}
        const brandData = brand.data || brand;
        
        if (brandData && brandData.name) {
          stores.push({
            sourceId: brandData.slug || brandData.id,
            name: brandData.name,
            thumbnail: brandData.logo || null
          });
        }
      });
    } else {
      console.log('[LOMADEE-STORES] Resposta não é um array:', typeof brandsArray);
    }
    
    console.log(`[LOMADEE-STORES] Total de lojas encontradas: ${stores.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        stores,
        total: stores.length
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error('[LOMADEE-STORES] Erro:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao buscar lojas'
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
