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

  console.log('🚀 [INICIO] Função search-leads V4 - BRASIL + BAIRROS + SEM DUPLICATAS')
  
  const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY')
  const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')
  const GOOGLE_CX = Deno.env.get('GOOGLE_CX')
  const APIFY_API_TOKEN = Deno.env.get('APIFY_API_KEY')

  console.log('🔑 [SECRETS] SERPAPI:', SERPAPI_KEY ? `✅ (${SERPAPI_KEY.substring(0, 8)}...)` : '❌')
  console.log('🔑 [SECRETS] GOOGLE:', GOOGLE_API_KEY && GOOGLE_CX ? '✅' : '❌')
  
  try {
    const body = await req.json()
    console.log('📦 [BODY]', JSON.stringify(body, null, 2))

    const { campanha_id, icp_config_id } = body

    if (!campanha_id || !icp_config_id) {
      throw new Error('campanha_id e icp_config_id são obrigatórios')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Buscar ICP
    const { data: icp, error: icpError } = await supabase
      .from('icp_configs')
      .select('*')
      .eq('id', icp_config_id)
      .single()

    if (icpError || !icp) {
      throw new Error('ICP não encontrado')
    }

    console.log('✅ [ICP]', icp.nome)

    // Extrair configuração
    const profissao = icp.b2c_config?.profissoes?.[0] || icp.b2c_config?.profissao || 'médico'
    const cidade = icp.b2c_config?.cidades?.[0] || icp.b2c_config?.cidade || 'Rio de Janeiro'
    const estado = icp.filtros_avancados?.estados?.[0] || icp.b2c_config?.estado || 'RJ'
    const bairros = icp.b2c_config?.bairros || icp.filtros_avancados?.bairros || ''

    console.log('🎯 [BUSCA] Parâmetros:', { profissao, cidade, estado, bairros: bairros || 'Todos' })

    // LISTA DE BAIRROS (se fornecido)
    const bairrosList: string[] = bairros ? 
      bairros.split(',').map((b: string) => b.trim()).filter((b: string) => b.length > 0) : 
      []

    console.log('📍 [BAIRROS]', bairrosList.length > 0 ? bairrosList : 'Todos da cidade')

    // SET para evitar duplicatas
    const leadsUnicos = new Set<string>()
    let leads: any[] = []

    // FUNÇÃO PARA CHECAR SE JÁ EXISTE
    const isLeadDuplicado = (nome: string, linkedinUrl: string): boolean => {
      const key = `${nome.toLowerCase().trim()}_${linkedinUrl.toLowerCase()}`
      if (leadsUnicos.has(key)) {
        console.log('⚠️ [DUPLICATA] Ignorando:', nome)
        return true
      }
      leadsUnicos.add(key)
      return false
    }

    // Buscar leads existentes para evitar duplicatas com o banco
    const { data: leadsExistentes } = await supabase
      .from('leads_b2c')
      .select('linkedin_url, nome_completo')
      .eq('campanha_id', campanha_id)

    if (leadsExistentes) {
      for (const lead of leadsExistentes) {
        if (lead.linkedin_url) {
          leadsUnicos.add(`${lead.nome_completo?.toLowerCase().trim()}_${lead.linkedin_url.toLowerCase()}`)
        }
      }
      console.log('📊 [DB] Leads existentes carregados:', leadsExistentes.length)
    }

    // ============ MÉTODO 1: SERPAPI COM FILTROS BRASIL ============
    if (SERPAPI_KEY && SERPAPI_KEY !== 'undefined' && SERPAPI_KEY.length > 10) {
      console.log('🔍 [SERPAPI] ========== BUSCANDO COM FILTROS BRASIL ==========')
      
      try {
        // Se tem bairros específicos, busca por cada um
        const searchQueries = bairrosList.length > 0 
          ? bairrosList.map(bairro => 
              `site:linkedin.com/in "${profissao}" "${bairro}" "${cidade}" Brazil`
            )
          : [`site:linkedin.com/in "${profissao}" "${cidade}" "${estado}" Brazil`]

        console.log('🔍 [SERPAPI] Total de queries:', searchQueries.length)

        for (const query of searchQueries) {
          console.log('🔍 [QUERY]', query)
          
          const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&location=Brazil&hl=pt&gl=br&num=20&api_key=${SERPAPI_KEY}`
          
          const serpResponse = await fetch(serpUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          })

          if (!serpResponse.ok) {
            console.error('❌ [SERPAPI] HTTP', serpResponse.status)
            continue
          }

          const serpData = await serpResponse.json()

          if (serpData.error) {
            console.error('❌ [SERPAPI] Erro:', serpData.error)
            continue
          }

          const results = serpData.organic_results || []
          console.log(`📊 [SERPAPI] Resultados para query: ${results.length}`)

          for (const result of results) {
            if (result.link && result.link.includes('linkedin.com/in/')) {
              const nome = result.title?.split('-')[0]?.split('|')[0]?.trim() || result.title
              
              if (nome && nome.length >= 3 && !isLeadDuplicado(nome, result.link)) {
                // Extrair bairro do snippet se possível
                let bairroEncontrado = ''
                if (bairrosList.length > 0) {
                  for (const b of bairrosList) {
                    if (result.snippet?.toLowerCase().includes(b.toLowerCase())) {
                      bairroEncontrado = b
                      break
                    }
                  }
                }

                leads.push({
                  nome_completo: nome,
                  profissao: profissao,
                  cidade: cidade,
                  estado: estado,
                  bairro: bairroEncontrado || null,
                  linkedin_url: result.link,
                  fonte: 'serpapi',
                  fonte_snippet: result.snippet?.substring(0, 300),
                  query_usada: query,
                  pipeline_status: 'descoberto',
                  score: 60,
                  campanha_id: campanha_id,
                  user_id: icp.user_id
                })
                console.log('✅ [SERPAPI] Lead:', nome, bairroEncontrado ? `(${bairroEncontrado})` : '')
              }
            }
          }

          // Pausa entre queries para não sobrecarregar
          if (searchQueries.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }

        console.log(`✅ [SERPAPI] Total de leads únicos: ${leads.length}`)

      } catch (error) {
        const err = error as Error
        console.error('❌ [SERPAPI] ERRO:', err.message)
      }
    }

    // ============ MÉTODO 2: GOOGLE CSE COMO FALLBACK ============
    if (leads.length === 0 && GOOGLE_API_KEY && GOOGLE_CX) {
      console.log('🔍 [GOOGLE] ========== FALLBACK GOOGLE CSE ==========')
      
      try {
        const searchQueries = bairrosList.length > 0 
          ? bairrosList.map(bairro => 
              `"${profissao}" "${bairro}" "${cidade}" linkedin.com/in Brasil`
            )
          : [`"${profissao}" "${cidade}" "${estado}" linkedin.com/in Brasil`]

        for (const query of searchQueries) {
          console.log('🔍 [GOOGLE] Query:', query)
          
          const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}&num=10&cr=countryBR&gl=br&hl=pt`
          
          const googleResponse = await fetch(googleUrl)
          
          if (!googleResponse.ok) {
            console.error('❌ [GOOGLE] HTTP', googleResponse.status)
            continue
          }

          const googleData = await googleResponse.json()

          if (googleData.error) {
            console.error('❌ [GOOGLE] Erro:', googleData.error.message)
            continue
          }

          console.log('📊 [GOOGLE] Itens:', googleData.items?.length || 0)

          if (googleData.items) {
            for (const item of googleData.items) {
              if (item.link?.includes('linkedin.com/in/')) {
                const nome = item.title?.split('-')[0]?.trim()
                
                if (nome && nome.length >= 3 && !isLeadDuplicado(nome, item.link)) {
                  let bairroEncontrado = ''
                  if (bairrosList.length > 0) {
                    for (const b of bairrosList) {
                      if (item.snippet?.toLowerCase().includes(b.toLowerCase())) {
                        bairroEncontrado = b
                        break
                      }
                    }
                  }

                  leads.push({
                    nome_completo: nome,
                    profissao: profissao,
                    cidade: cidade,
                    estado: estado,
                    bairro: bairroEncontrado || null,
                    linkedin_url: item.link,
                    fonte: 'google_cse',
                    fonte_snippet: item.snippet?.substring(0, 300),
                    query_usada: query,
                    pipeline_status: 'descoberto',
                    score: 50,
                    campanha_id: campanha_id,
                    user_id: icp.user_id
                  })
                  console.log('✅ [GOOGLE] Lead:', nome)
                }
              }
            }
          }

          if (searchQueries.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 300))
          }
        }

        console.log(`✅ [GOOGLE] Total de leads únicos: ${leads.length}`)

      } catch (error) {
        const err = error as Error
        console.error('❌ [GOOGLE] ERRO:', err.message)
      }
    }

    // ============ SALVAR LEADS ============
    console.log(`💾 [SALVAR] Total de leads únicos para salvar: ${leads.length}`)

    if (leads.length > 0) {
      const { data: insertData, error: insertError } = await supabase
        .from('leads_b2c')
        .insert(leads)
        .select()

      if (insertError) {
        console.error('❌ [DB] Erro ao salvar:', insertError.message)
        
        // Tentar inserir um por um se falhou em lote
        let salvos = 0
        for (const lead of leads) {
          const { error: singleError } = await supabase
            .from('leads_b2c')
            .insert(lead)
          
          if (!singleError) salvos++
        }
        console.log(`✅ [DB] Salvos individualmente: ${salvos}/${leads.length}`)
      } else {
        console.log(`✅ [DB] ${leads.length} leads salvos com sucesso`)
      }

      // Atualizar stats da campanha
      const { data: currentStats } = await supabase
        .from('campanhas_prospeccao')
        .select('stats')
        .eq('id', campanha_id)
        .single()

      const descobertosAtuais = (currentStats?.stats as any)?.descobertos || 0

      await supabase
        .from('campanhas_prospeccao')
        .update({
          stats: {
            descobertos: descobertosAtuais + leads.length,
            enriquecidos: (currentStats?.stats as any)?.enriquecidos || 0,
            qualificados: (currentStats?.stats as any)?.qualificados || 0,
            enviados: (currentStats?.stats as any)?.enviados || 0,
            responderam: (currentStats?.stats as any)?.responderam || 0,
            convertidos: (currentStats?.stats as any)?.convertidos || 0
          }
        })
        .eq('id', campanha_id)
    }

    console.log('✅ [FIM] Busca concluída com', leads.length, 'leads únicos')

    return new Response(JSON.stringify({
      success: true,
      leads_encontrados: leads.length,
      fonte: leads[0]?.fonte || 'nenhuma',
      bairros_buscados: bairrosList.length > 0 ? bairrosList : ['Todos'],
      debug: {
        serpapi_configured: !!SERPAPI_KEY,
        google_configured: !!(GOOGLE_API_KEY && GOOGLE_CX),
        duplicatas_evitadas: leadsUnicos.size - leads.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    const err = error as Error
    console.error('❌ [ERRO FATAL]', err.message)
    
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
