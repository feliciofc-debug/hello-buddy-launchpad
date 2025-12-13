import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Iniciando busca de leads enriquecidos...');
    
    const params = await req.json();
    console.log('Parâmetros recebidos:', params);
    
    // Criar cliente Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extrair user_id do token JWT
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    console.log('User ID:', userId);
    
    // ⚠️ IMPORTANTE: Não geramos dados fake!
    // Esta função deve buscar leads REAIS de fontes como:
    // 1. Google Places API (reviews de imobiliárias)
    // 2. Apify scrapers (LinkedIn, Instagram, OLX)
    // 3. APIs de validação de dados
    
    // Por enquanto, retornar lista vazia até integração real
    console.log('⚠️ Integração com Google Places API pendente');
    console.log('⚠️ Nenhum dado fake será gerado');
    
    return new Response(
      JSON.stringify({
        success: true,
        total: 0,
        leads: [],
        message: 'Integração com Google Places API pendente. Configure GOOGLE_PLACES_API_KEY para buscar leads reais.'
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
    
  } catch (error: unknown) {
    console.error('❌ Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({
        error: errorMessage
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});
