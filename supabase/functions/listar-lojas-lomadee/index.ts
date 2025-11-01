import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

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

    // Chamar API da Lomadee para listar ofertas/lojas
    const lomadeeUrl = `https://api.lomadee.com/v3/${appToken}/offer/_search?size=100`;
    
    console.log('[LOMADEE-STORES] URL:', lomadeeUrl);

    const response = await fetch(lomadeeUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LOMADEE-STORES] Erro na API:', response.status, errorText);
      throw new Error(`Erro ao buscar lojas: ${response.status}`);
    }

    const data = await response.json();
    console.log('[LOMADEE-STORES] Resposta recebida');

    // Extrair lojas únicas das ofertas
    const storesMap = new Map();

    if (data.offers && Array.isArray(data.offers)) {
      data.offers.forEach((offer: any) => {
        if (offer.store && offer.store.id) {
          storesMap.set(offer.store.id, {
            sourceId: offer.store.id,
            name: offer.store.name || `Loja ${offer.store.id}`,
            thumbnail: offer.store.thumbnail || null
          });
        }
      });
    }

    const stores = Array.from(storesMap.values());
    
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
