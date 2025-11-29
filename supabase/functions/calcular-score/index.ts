import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Profissões de alto valor
const PROFISSOES_PREMIUM = ['médico', 'medico', 'advogado', 'advogada', 'médica', 'medica', 'doutor', 'doutora', 'dr', 'dra'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { leadId, leadTipo = 'b2c' } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const tabela = leadTipo === 'b2b' ? 'leads_b2b' : 'leads_b2c';

    const { data: lead, error: fetchError } = await supabase
      .from(tabela)
      .select('*')
      .eq('id', leadId)
      .single()

    if (fetchError) throw fetchError

    let score = 0
    const criterios = []

    // ========== NOVO SISTEMA DE PONTUAÇÃO ==========

    // 1. PROFISSÃO PREMIUM: Médicos, Advogados = +30 pontos
    const profissaoLower = (lead.profissao || '').toLowerCase();
    const especialidadeLower = (lead.especialidade || '').toLowerCase();
    
    const isProfissaoPremium = PROFISSOES_PREMIUM.some(p => 
      profissaoLower.includes(p) || especialidadeLower.includes(p)
    );
    
    if (isProfissaoPremium) {
      score += 30
      criterios.push('Profissão premium (médico/advogado): +30')
    }

    // 2. TELEFONE/WHATSAPP VÁLIDO = +20 pontos
    const telefone = lead.telefone || lead.whatsapp || '';
    const telefoneNumeros = telefone.replace(/\D/g, '');
    if (telefoneNumeros.length >= 10) {
      score += 20
      criterios.push('Telefone/WhatsApp válido: +20')
    }

    // 3. EMAIL = +10 pontos
    if (lead.email && lead.email.includes('@')) {
      score += 10
      criterios.push('Email: +10')
    }

    // 4. LOCALIZAÇÃO COMPLETA (cidade + estado) = +10 pontos
    if (lead.cidade && lead.estado) {
      score += 10
      criterios.push('Localização completa: +10')
    }

    // 5. REDES SOCIAIS = +10 pontos CADA
    if (lead.linkedin_url || lead.linkedin_id) {
      score += 10
      criterios.push('LinkedIn: +10')
    }
    if (lead.instagram_username) {
      score += 10
      criterios.push('Instagram: +10')
    }
    if (lead.facebook_url || lead.facebook_id) {
      score += 10
      criterios.push('Facebook: +10')
    }
    if (lead.site_url) {
      score += 10
      criterios.push('Site próprio: +10')
    }

    // ========== BÔNUS EXTRAS ==========
    
    // CRM/OAB/CREA (registro profissional)
    if (lead.crm || lead.oab || lead.crea) {
      score += 15
      criterios.push('Registro profissional: +15')
    }

    // Especialidade definida
    if (lead.especialidade) {
      score += 5
      criterios.push('Especialidade definida: +5')
    }

    // Consultório próprio (para médicos)
    if (lead.tem_consultorio) {
      score += 10
      criterios.push('Consultório próprio: +10')
    }

    // Determinar status baseado no score
    let pipeline_status = 'descoberto'
    if (score >= 70) pipeline_status = 'qualificado'
    else if (score >= 50) pipeline_status = 'enriquecido'

    const justificativa = criterios.join(' | ')

    console.log(`✅ Score calculado para ${lead.nome_completo || lead.razao_social}: ${score} | Status: ${pipeline_status}`)
    console.log(`📊 Critérios: ${justificativa}`)

    // Atualizar lead
    const { error: updateError } = await supabase
      .from(tabela)
      .update({ 
        score, 
        pipeline_status,
        score_breakdown: { criterios, calculado_em: new Date().toISOString() }
      })
      .eq('id', leadId)

    if (updateError) throw updateError

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
