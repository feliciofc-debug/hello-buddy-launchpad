import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { campanhaId } = await req.json()

    console.log('🚀 Iniciando campanha:', campanhaId)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Buscar dados da campanha
    const { data: campanha, error: campanhaError } = await supabase
      .from('campanhas_prospeccao')
      .select('*, icp_configs(*)')
      .eq('id', campanhaId)
      .single()

    if (campanhaError) throw campanhaError

    const icp = campanha.icp_configs
    console.log('📊 ICP:', icp.nome)

    let totalLeads = 0

    // 2. Buscar leads conforme fontes habilitadas
    for (const fonte of icp.fontes_habilitadas || []) {
      console.log(`🔍 Buscando em: ${fonte}`)

      if (fonte === 'CFM' && icp.profissoes?.includes('Médico')) {
        // Buscar médicos
        for (const estado of icp.estados || []) {
          const { data: cfmData } = await supabase.functions.invoke('buscar-cfm', {
            body: {
              especialidade: icp.especialidades?.[0] || 'Dermatologia',
              uf: estado,
              cidade: icp.cidades?.[0] || '',
              campanhaId: campanhaId
            }
          })
          
          if (cfmData?.leads) {
            totalLeads += cfmData.leads.length
            console.log(`✅ ${cfmData.leads.length} médicos em ${estado}`)
          }
        }
      }

      // Registrar execução da fonte
      await supabase
        .from('campanhas_multiplas_fontes')
        .insert({
          campanha_id: campanhaId,
          fonte: fonte,
          leads_descobertos: totalLeads,
          status: 'concluida',
          executada_em: new Date().toISOString()
        })
    }

    // 3. Buscar todos os leads descobertos
    const { data: leadsDescobertos } = await supabase
      .from('leads_b2c')
      .select('id, nome_completo')
      .eq('campanha_id', campanhaId)
      .eq('pipeline_status', 'descoberto')

    console.log(`📋 ${leadsDescobertos?.length} leads para enriquecer`)

    // 4. Enriquecer cada lead
    let enriquecidos = 0
    for (const lead of leadsDescobertos || []) {
      try {
        // Facebook
        if (icp.fontes_habilitadas?.includes('Facebook')) {
          await supabase.functions.invoke('enriquecer-facebook', {
            body: { leadId: lead.id, nome: lead.nome_completo }
          })
        }

        // Calcular score
        await supabase.functions.invoke('calcular-score', {
          body: { leadId: lead.id }
        })

        enriquecidos++
      } catch (err) {
        console.error(`Erro ao enriquecer ${lead.id}:`, err)
      }
    }

    console.log(`✅ ${enriquecidos} leads enriquecidos`)

    // 5. Atualizar status da campanha
    await supabase
      .from('campanhas_prospeccao')
      .update({ 
        status: 'concluida',
        total_leads: totalLeads
      })
      .eq('id', campanhaId)

    return new Response(JSON.stringify({ 
      success: true,
      totalLeads,
      enriquecidos,
      message: `Campanha concluída! ${totalLeads} leads descobertos, ${enriquecidos} enriquecidos`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Erro na campanha:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
