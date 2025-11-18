import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { especialidade, uf, cidade, campanhaId } = await req.json()

    console.log('🔍 Buscando médicos CFM:', { especialidade, uf, cidade })

    // Mock de dados (depois implementar scraping real)
    const nomes = ['João Silva', 'Maria Santos', 'Pedro Oliveira', 'Ana Costa', 'Carlos Mendes']
    const especialidades = especialidade ? [especialidade] : ['Dermatologia', 'Cardiologia', 'Ortopedia']
    
    const leadsMock = []
    for (let i = 0; i < 5; i++) {
      leadsMock.push({
        nome_completo: `Dr(a). ${nomes[i]}`,
        crm: `${uf}-${12345 + i}`,
        especialidade: especialidades[i % especialidades.length],
        uf: uf,
        cidade: cidade,
        profissao: 'médico',
        fonte: 'CFM',
        pipeline_status: 'descoberto',
        score: 20,
        campanha_id: campanhaId,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data, error } = await supabase
      .from('leads_b2c')
      .insert(leadsMock)
      .select()

    if (error) {
      console.error('Erro ao inserir leads:', error)
      throw error
    }

    console.log(`✅ ${leadsMock.length} médicos descobertos!`)

    return new Response(JSON.stringify({ 
      success: true, 
      total: leadsMock.length,
      leads: data 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Erro na função:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})