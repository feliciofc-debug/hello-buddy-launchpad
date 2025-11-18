import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { leadId } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: lead, error: fetchError } = await supabase
      .from('leads_b2c')
      .select('*')
      .eq('id', leadId)
      .single()

    if (fetchError) throw fetchError

    let score = 0
    const criterios = []

    // Sistema de pontuação
    if (lead.crm || lead.oab || lead.crea) {
      score += 20
      criterios.push('Registro profissional: +20')
    }
    if (lead.especialidade) {
      score += 15
      criterios.push('Especialidade: +15')
    }
    if (lead.tem_consultorio) {
      score += 25
      criterios.push('Consultório próprio: +25')
    }
    if (lead.email) {
      score += 10
      criterios.push('Email: +10')
    }
    if (lead.telefone) {
      score += 10
      criterios.push('Telefone: +10')
    }
    if (lead.facebook_id) {
      score += 10
      criterios.push('Facebook: +10')
    }
    if (lead.linkedin_url) {
      score += 15
      criterios.push('LinkedIn: +15')
    }
    if (lead.instagram_username) {
      score += 10
      criterios.push('Instagram: +10')
      if (lead.instagram_seguidores > 1000) {
        score += 10
        criterios.push('Instagram ativo (>1k): +10')
      }
    }
    if (lead.site_url) {
      score += 20
      criterios.push('Site próprio: +20')
    }
    if (lead.cidade && ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte'].includes(lead.cidade)) {
      score += 10
      criterios.push('Cidade grande: +10')
    }

    // Determinar status
    let pipeline_status = 'frio'
    if (score >= 80) pipeline_status = 'quente'
    else if (score >= 50) pipeline_status = 'morno'

    const justificativa = criterios.join(' | ')

    // Atualizar lead
    const { error: updateError } = await supabase
      .from('leads_b2c')
      .update({ 
        score, 
        pipeline_status,
        justificativa
      })
      .eq('id', leadId)

    if (updateError) throw updateError

    console.log(`✅ Score calculado: ${score} | Status: ${pipeline_status}`)

    return new Response(JSON.stringify({ 
      success: true, 
      score,
      pipeline_status,
      criterios
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