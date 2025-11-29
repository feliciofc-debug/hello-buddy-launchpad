import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { campanha_id, icp_config_id, fontes = ['linkedin', 'instagram'], validarWhatsApp = true, scoreMinimo = 50 } = await req.json()

    console.log(`🚀 Iniciando geração de leads de QUALIDADE`)
    console.log(`📋 Campanha: ${campanha_id}`)
    console.log(`🎯 Fontes: ${fontes.join(', ')}`)
    console.log(`✅ Validar WhatsApp: ${validarWhatsApp}`)

    // Buscar configuração ICP
    const { data: icpConfig, error: icpError } = await supabase
      .from('icp_configs')
      .select('*')
      .eq('id', icp_config_id)
      .single()

    if (icpError || !icpConfig) {
      throw new Error('Configuração ICP não encontrada')
    }

    // Buscar user_id da campanha
    const { data: campanha } = await supabase
      .from('campanhas_prospeccao')
      .select('user_id')
      .eq('id', campanha_id)
      .single()

    const user_id = campanha?.user_id

    let allLeads: any[] = []
    const stats = {
      linkedin_encontrados: 0,
      instagram_encontrados: 0,
      whatsapp_validos: 0,
      whatsapp_invalidos: 0,
      salvos: 0,
      descartados: 0
    }

    const profissao = icpConfig.b2c_config?.profissao || icpConfig.b2b_config?.setor || 'profissional'
    const cidade = icpConfig.b2c_config?.cidade || icpConfig.b2b_config?.cidades?.[0] || 'São Paulo'
    const estado = icpConfig.b2c_config?.estado || 'SP'

    // 1. BUSCAR NO LINKEDIN (PRIORIDADE MÁXIMA)
    if (fontes.includes('linkedin')) {
      console.log(`🔗 Buscando no LinkedIn: "${profissao} ${cidade}"`)
      
      try {
        const linkedinResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/apify-linkedin-scraper`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            searchQuery: `${profissao} ${cidade}`,
            location: 'Brazil',
            maxResults: 20
          })
        })

        const linkedinData = await linkedinResponse.json()
        
        if (linkedinData.success && linkedinData.leads) {
          stats.linkedin_encontrados = linkedinData.leads.length
          allLeads.push(...linkedinData.leads.map((l: any) => ({ ...l, fonte_primaria: 'linkedin' })))
          console.log(`✅ LinkedIn: ${linkedinData.leads.length} perfis encontrados`)
        }
      } catch (e) {
        console.error('❌ Erro LinkedIn:', e)
      }
    }

    // 2. BUSCAR NO INSTAGRAM (SECUNDÁRIO)
    if (fontes.includes('instagram')) {
      const hashtag = profissao.toLowerCase().replace(/\s+/g, '').replace(/[áàã]/g, 'a').replace(/[éê]/g, 'e').replace(/[íì]/g, 'i').replace(/[óôõ]/g, 'o').replace(/[úù]/g, 'u')
      
      console.log(`📸 Buscando no Instagram: #${hashtag}`)
      
      try {
        const instaResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/apify-instagram-scraper`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            hashtag: hashtag,
            searchQuery: `${profissao} ${cidade}`,
            maxResults: 30
          })
        })

        const instaData = await instaResponse.json()
        
        if (instaData.success && instaData.leads) {
          stats.instagram_encontrados = instaData.leads.length
          allLeads.push(...instaData.leads.map((l: any) => ({ ...l, fonte_primaria: 'instagram' })))
          console.log(`✅ Instagram: ${instaData.leads.length} perfis encontrados`)
        }
      } catch (e) {
        console.error('❌ Erro Instagram:', e)
      }
    }

    console.log(`📊 Total bruto: ${allLeads.length} leads`)

    // 3. VALIDAR WHATSAPP DE CADA LEAD
    const leadsValidados: any[] = []

    for (const lead of allLeads) {
      const telefone = lead.telefone || lead.businessPhoneNumber

      if (!telefone) {
        console.log(`⏭️ Lead sem telefone: ${lead.nome_completo}`)
        stats.descartados++
        continue
      }

      if (validarWhatsApp) {
        try {
          const validateResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/validate-whatsapp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({ phone: telefone })
          })

          const validation = await validateResponse.json()

          if (validation.valid) {
            stats.whatsapp_validos++
            leadsValidados.push({
              ...lead,
              telefone: validation.phone,
              whatsapp: validation.phone,
              whatsapp_verificado: true
            })
            console.log(`✅ WhatsApp válido: ${validation.phone}`)
          } else {
            stats.whatsapp_invalidos++
            console.log(`❌ WhatsApp inválido: ${telefone}`)
          }
        } catch (e) {
          console.error(`❌ Erro validando ${telefone}:`, e)
          stats.whatsapp_invalidos++
        }

        // Delay para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500))
      } else {
        // Sem validação, adiciona direto
        leadsValidados.push({
          ...lead,
          whatsapp_verificado: false
        })
      }
    }

    console.log(`📊 Leads com WhatsApp válido: ${leadsValidados.length}`)

    // 4. CALCULAR SCORE REAL
    const leadsComScore = leadsValidados.map(lead => {
      let score = 0
      const criterios: string[] = []

      // LinkedIn verificado: +30
      if (lead.linkedin_url || lead.linkedin_id) {
        score += 30
        criterios.push('LinkedIn verificado: +30')
      }

      // Instagram verificado/business: +20
      if (lead.instagram_url && (lead.is_verified || lead.is_business)) {
        score += 20
        criterios.push('Instagram Business: +20')
      }

      // WhatsApp verificado: +25
      if (lead.whatsapp_verificado) {
        score += 25
        criterios.push('WhatsApp verificado: +25')
      }

      // Email profissional (não gmail/hotmail): +15
      if (lead.email && !lead.email.includes('gmail') && !lead.email.includes('hotmail') && !lead.email.includes('yahoo')) {
        score += 15
        criterios.push('Email profissional: +15')
      }

      // Conexões LinkedIn > 500: +10
      if (lead.conexoes && lead.conexoes > 500) {
        score += 10
        criterios.push('500+ conexões: +10')
      }

      // Seguidores Instagram > 1000: +10
      if (lead.seguidores && lead.seguidores > 1000) {
        score += 10
        criterios.push('1000+ seguidores: +10')
      }

      // Cargo atual definido: +5
      if (lead.cargo_atual || lead.profissao) {
        score += 5
        criterios.push('Cargo definido: +5')
      }

      return {
        ...lead,
        score: score,
        score_breakdown: { criterios, calculado_em: new Date().toISOString() },
        pipeline_status: score >= 70 ? 'qualificado' : score >= 50 ? 'enriquecido' : 'descoberto'
      }
    })

    // 5. FILTRAR POR SCORE MÍNIMO
    const leadsFiltrados = leadsComScore.filter(l => l.score >= scoreMinimo)
    console.log(`📊 Leads com score >= ${scoreMinimo}: ${leadsFiltrados.length}`)

    // 6. SALVAR NO BANCO
    const tabela = icpConfig.tipo === 'b2b' ? 'leads_b2b' : 'leads_b2c'

    for (const lead of leadsFiltrados) {
      // Verificar duplicata
      const { data: existente } = await supabase
        .from(tabela)
        .select('id')
        .eq('campanha_id', campanha_id)
        .or(`telefone.eq.${lead.telefone},linkedin_url.eq.${lead.linkedin_url || ''},instagram_username.eq.${lead.instagram_username || ''}`)
        .maybeSingle()

      if (existente) {
        console.log(`⏭️ Lead duplicado: ${lead.nome_completo}`)
        stats.descartados++
        continue
      }

      const leadData = {
        campanha_id,
        user_id,
        nome_completo: lead.nome_completo,
        profissao: lead.profissao || profissao,
        especialidade: lead.especialidade || lead.cargo_atual,
        cidade: lead.cidade || cidade,
        estado: lead.estado || estado,
        telefone: lead.telefone,
        whatsapp: lead.whatsapp,
        whatsapp_status: lead.whatsapp_verificado ? 'verificado' : 'pendente',
        email: lead.email,
        linkedin_url: lead.linkedin_url,
        linkedin_id: lead.linkedin_id,
        instagram_username: lead.instagram_username,
        instagram_seguidores: lead.seguidores,
        site_url: lead.website,
        fonte: lead.fonte_primaria || lead.fonte,
        fonte_url: lead.linkedin_url || lead.instagram_url,
        score: lead.score,
        score_breakdown: lead.score_breakdown,
        pipeline_status: lead.pipeline_status,
        dados_enriquecidos: {
          foto_url: lead.foto_url,
          conexoes_linkedin: lead.conexoes,
          empresa_atual: lead.empresa_atual,
          cargo_atual: lead.cargo_atual,
          is_instagram_business: lead.is_business,
          is_instagram_verified: lead.is_verified,
          categoria_negocio: lead.categoria_negocio,
          biografia: lead.biografia
        }
      }

      const { error: insertError } = await supabase
        .from(tabela)
        .insert(leadData)

      if (insertError) {
        console.error(`❌ Erro salvando ${lead.nome_completo}:`, insertError)
        stats.descartados++
      } else {
        stats.salvos++
        console.log(`✅ Lead salvo: ${lead.nome_completo} (score: ${lead.score})`)
      }
    }

    // Atualizar stats da campanha
    await supabase
      .from('campanhas_prospeccao')
      .update({
        stats: {
          ...stats,
          ultima_execucao: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', campanha_id)

    console.log(`🏁 Geração concluída!`)
    console.log(`📊 Stats:`, stats)

    return new Response(JSON.stringify({
      success: true,
      stats,
      message: `${stats.salvos} leads de qualidade salvos!`
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('❌ Erro geral:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(JSON.stringify({
      error: errorMessage
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
