import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { leadId, nome } = await req.json()
    
    console.log('🔍 Enriquecendo via Facebook:', nome)

    // Mock de enriquecimento (implementar API real depois)
    const enrichedData = {
      facebook_id: `fb_${Math.random().toString(36).substr(2, 9)}`,
      email: `${nome.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      cidade: ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte'][Math.floor(Math.random() * 3)],
      dados_enriquecidos: {
        fonte: 'facebook',
        encontrado_em: new Date().toISOString()
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error } = await supabase
      .from('leads_b2c')
      .update({
        ...enrichedData,
        pipeline_status: 'enriquecido'
      })
      .eq('id', leadId)

    if (error) throw error

    console.log('✅ Lead enriquecido!')

    return new Response(JSON.stringify({ 
      success: true, 
      enriched: true,
      data: enrichedData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Erro:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})