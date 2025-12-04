import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mapear setores para termos de EMPRESAS
const mapSetores: Record<string, string[]> = {
  'agricultura': ['agrícola', 'agronegócio', 'grãos', 'fertilizantes', 'sementes'],
  'indústria': ['indústria', 'fábrica', 'manufatura', 'industrial'],
  'construção': ['construtora', 'materiais construção', 'engenharia'],
  'alimentação': ['alimentos', 'bebidas', 'food service', 'frigorífico'],
  'automotivo': ['autopeças', 'veículos', 'automotive', 'concessionária'],
  'tecnologia': ['tecnologia', 'software', 'TI', 'informática'],
  'saúde': ['hospitalar', 'equipamentos médicos', 'farmacêutico'],
  'varejo': ['distribuidor', 'atacado', 'comércio'],
  'logística': ['logística', 'transporte', 'armazém', 'frete'],
  'energia': ['energia', 'petróleo', 'gás', 'elétrica'],
  'químico': ['química', 'petroquímica', 'plásticos'],
  'mineração': ['mineração', 'siderurgia', 'metalurgia'],
  'têxtil': ['têxtil', 'confecção', 'vestuário'],
  'papel': ['papel', 'celulose', 'embalagens'],
  'farmacêutico': ['farmacêutico', 'medicamentos', 'laboratório']
}

// Tipos de empresas para busca B2B
const tiposEmpresaComex = [
  'importadora', 'exportadora', 'trading', 
  'distribuidora', 'atacadista', 'fornecedor'
]

// Funções auxiliares
const extrairTelefone = (text: string): string | null => {
  if (!text) return null
  const regex = /(?:\+55|55)?[\s.-]?\(?([1-9]{2})\)?[\s.-]?(?:9[\s.-]?)?([0-9]{4})[\s.-]?([0-9]{4})/g
  const match = regex.exec(text)
  if (match) {
    return `+55${match[1]}${match[2]}${match[3]}`
  }
  return null
}

const extrairEmail = (text: string): string | null => {
  if (!text) return null
  const regex = /[\w.-]+@[\w.-]+\.\w+/g
  const match = regex.exec(text)
  return match ? match[0] : null
}

const limparNomeEmpresa = (title: string): string => {
  if (!title) return 'Empresa não identificada'
  return title
    .split('|')[0]
    .split(' - ')[0]
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/\.\.\./g, '')
    .trim()
    .substring(0, 150)
}

// Gerar CNPJ fictício único baseado no nome da empresa
const gerarCnpjFicticio = (nome: string, index: number): string => {
  const hash = nome.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const timestamp = Date.now().toString().slice(-8)
  const cnpj = `${String(hash % 100).padStart(2, '0')}${String(index).padStart(3, '0')}${timestamp}${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`
  return cnpj.substring(0, 14).padEnd(14, '0')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log('🚀 [INICIO] Função search-leads V6 - BUSCA DE EMPRESAS (não pessoas)')
  
  const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY')
  const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')

  console.log('🔑 [SECRETS] SERPAPI:', SERPAPI_KEY ? `✅ (${SERPAPI_KEY.substring(0, 8)}...)` : '❌')
  console.log('🔑 [SECRETS] GOOGLE:', GOOGLE_API_KEY ? '✅' : '❌')
  
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
    console.log('📋 [ICP CONFIG]', JSON.stringify(icp, null, 2))

    // Extrair configuração
    const isB2B = icp.tipo === 'b2b'
    const setores = icp.b2b_config?.setores || icp.filtros_avancados?.setores || []
    const profissao = icp.b2c_config?.profissoes?.[0] || icp.b2c_config?.profissao || ''
    
    const cidade = icp.b2c_config?.cidades?.[0] || icp.b2c_config?.cidade || icp.b2b_config?.cidade || 'Rio de Janeiro'
    const estado = icp.filtros_avancados?.estados?.[0] || icp.b2c_config?.estado || icp.b2b_config?.estado || 'RJ'
    const bairros = icp.b2c_config?.bairros || icp.filtros_avancados?.bairros || ''

    console.log('🎯 [TIPO]', isB2B ? 'B2B (EMPRESAS)' : 'B2C (Profissionais)')
    console.log('🎯 [BUSCA] Parâmetros:', { setores, profissao, cidade, estado, bairros })

    // SET para evitar duplicatas
    const empresasUnicas = new Set<string>()
    let leads: any[] = []

    // Verificar duplicata
    const isEmpresaDuplicada = (nome: string, website?: string): boolean => {
      const key = `${nome.toLowerCase().trim()}_${website?.toLowerCase() || ''}`
      if (empresasUnicas.has(key)) {
        console.log('⚠️ [DUPLICATA] Ignorando:', nome)
        return true
      }
      empresasUnicas.add(key)
      return false
    }

    // Buscar leads existentes
    const tabela = isB2B ? 'leads_b2b' : 'leads_b2c'
    const { data: leadsExistentes } = await supabase
      .from(tabela)
      .select('razao_social, nome_fantasia, site_url')
      .eq('campanha_id', campanha_id)

    if (leadsExistentes) {
      for (const lead of leadsExistentes) {
        const nome = lead.razao_social || lead.nome_fantasia || ''
        empresasUnicas.add(`${nome.toLowerCase().trim()}_${lead.site_url?.toLowerCase() || ''}`)
      }
      console.log('📊 [DB] Leads existentes:', leadsExistentes.length)
    }

    // ============ GERAR QUERIES PARA EMPRESAS ============
    const gerarQueriesEmpresas = (): string[] => {
      const queries: string[] = []
      const localizacao = `${cidade} ${estado}`
      
      if (isB2B && setores.length > 0) {
        console.log('🏢 [MODO] B2B - Buscando EMPRESAS por setor')
        
        for (const setor of setores) {
          const termosSetor = mapSetores[setor.toLowerCase()] || [setor]
          
          // Queries específicas para EMPRESAS (não pessoas!)
          for (const tipoEmpresa of tiposEmpresaComex) {
            queries.push(`${tipoEmpresa} ${termosSetor[0]} ${localizacao}`)
          }
          
          // Queries adicionais
          queries.push(`comércio exterior ${termosSetor[0]} ${localizacao}`)
          queries.push(`empresa ${termosSetor[0]} importação ${localizacao}`)
          queries.push(`${termosSetor[0]} exportação ${localizacao}`)
        }
        
        // Queries genéricas de comex
        queries.push(`importadora ${localizacao}`)
        queries.push(`exportadora ${localizacao}`)
        queries.push(`trading company ${localizacao}`)
        
      } else if (profissao) {
        // MODO B2C: Buscar estabelecimentos/consultórios
        console.log('👤 [MODO] B2C - Buscando estabelecimentos de profissionais')
        
        queries.push(`${profissao} ${cidade}`)
        queries.push(`consultório ${profissao} ${cidade}`)
        queries.push(`clínica ${profissao} ${cidade}`)
        
        if (bairros) {
          const bairrosList = bairros.split(',').map((b: string) => b.trim())
          for (const bairro of bairrosList.slice(0, 3)) {
            queries.push(`${profissao} ${bairro} ${cidade}`)
          }
        }
      } else {
        // Fallback
        queries.push(`empresa ${localizacao}`)
        queries.push(`indústria ${localizacao}`)
      }
      
      return queries.slice(0, 15) // Limitar queries
    }

    const searchQueries = gerarQueriesEmpresas()
    console.log('🔍 [QUERIES] Total:', searchQueries.length)
    searchQueries.forEach((q, i) => console.log(`  Query ${i + 1}:`, q))

    // ============ SERPAPI - BUSCA DE EMPRESAS ============
    if (SERPAPI_KEY && SERPAPI_KEY !== 'undefined' && SERPAPI_KEY.length > 10) {
      console.log('🏢 [SERPAPI] ========== BUSCANDO EMPRESAS ==========')
      
      try {
        for (const query of searchQueries) {
          if (leads.length >= 50) {
            console.log('✅ [SERPAPI] Limite de 50 empresas atingido')
            break
          }
          
          console.log('🔍 [QUERY]', query)
          
          // Busca com engine=google_maps para resultados locais
          const serpUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(query)}&ll=@-22.9068,-43.1729,11z&hl=pt-br&api_key=${SERPAPI_KEY}`
          
          const serpResponse = await fetch(serpUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          })

          if (!serpResponse.ok) {
            console.error('❌ [SERPAPI MAPS] HTTP', serpResponse.status)
            
            // Fallback para busca normal
            const serpUrlNormal = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&location=Brazil&hl=pt&gl=br&num=20&api_key=${SERPAPI_KEY}`
            const serpResponseNormal = await fetch(serpUrlNormal)
            
            if (serpResponseNormal.ok) {
              const serpDataNormal = await serpResponseNormal.json()
              
              // Processar local_results (empresas locais)
              if (serpDataNormal.local_results?.places) {
                console.log('📍 [LOCAL RESULTS]', serpDataNormal.local_results.places.length)
                
                for (const place of serpDataNormal.local_results.places.slice(0, 10)) {
                  const nome = limparNomeEmpresa(place.title)
                  
                  if (nome && !isEmpresaDuplicada(nome, place.website)) {
                    leads.push({
                      razao_social: nome,
                      nome_fantasia: nome,
                      telefone: place.phone || extrairTelefone(place.snippet || ''),
                      endereco: place.address,
                      site_url: place.website,
                      cidade: cidade,
                      estado: estado,
                      fonte: 'serpapi_local',
                      fonte_snippet: place.snippet?.substring(0, 300),
                      query_usada: query,
                      pipeline_status: 'descoberto',
                      score: 70,
                      setor: setores[0] || 'Não identificado',
                      campanha_id: campanha_id,
                      user_id: icp.user_id,
                      cnpj: gerarCnpjFicticio(nome, leads.length)
                    })
                    console.log(`✅ [LOCAL] ${nome} | ${place.phone || 'Sem tel'} | ${place.address || 'Sem end'}`)
                  }
                }
              }
              
              // Processar organic_results (excluir LinkedIn!)
              if (serpDataNormal.organic_results) {
                const empresasOrganic = serpDataNormal.organic_results.filter((r: any) => 
                  !r.link?.includes('linkedin.com') && 
                  !r.link?.includes('facebook.com/people') &&
                  !r.link?.includes('instagram.com')
                )
                
                console.log('🌐 [ORGANIC] Empresas:', empresasOrganic.length)
                
                for (const result of empresasOrganic.slice(0, 10)) {
                  const nome = limparNomeEmpresa(result.title)
                  const telefone = extrairTelefone(result.snippet || '')
                  const email = extrairEmail(result.snippet || '')
                  
                  if (nome && nome.length > 3 && !isEmpresaDuplicada(nome, result.link)) {
                    leads.push({
                      razao_social: nome,
                      nome_fantasia: nome,
                      telefone: telefone,
                      email: email,
                      site_url: result.link,
                      cidade: cidade,
                      estado: estado,
                      fonte: 'serpapi_organic',
                      fonte_snippet: result.snippet?.substring(0, 300),
                      query_usada: query,
                      pipeline_status: 'descoberto',
                      score: 55,
                      setor: setores[0] || 'Não identificado',
                      campanha_id: campanha_id,
                      user_id: icp.user_id,
                      cnpj: gerarCnpjFicticio(nome, leads.length)
                    })
                    console.log(`✅ [ORGANIC] ${nome} | ${telefone || 'Sem tel'} | ${result.link}`)
                  }
                }
              }
            }
            
            continue
          }

          const serpData = await serpResponse.json()

          if (serpData.error) {
            console.error('❌ [SERPAPI] Erro:', serpData.error)
            continue
          }

          // Processar resultados do Google Maps
          const places = serpData.local_results || serpData.place_results || []
          console.log(`📍 [GOOGLE MAPS] Empresas encontradas: ${places.length}`)

          for (const place of places.slice(0, 15)) {
            const nome = limparNomeEmpresa(place.title || place.name)
            
            if (nome && !isEmpresaDuplicada(nome, place.website)) {
              leads.push({
                razao_social: nome,
                nome_fantasia: nome,
                telefone: place.phone || place.phone_number,
                endereco: place.address,
                site_url: place.website,
                cidade: cidade,
                estado: estado,
                fonte: 'google_maps',
                fonte_snippet: `Rating: ${place.rating || 'N/A'} | Reviews: ${place.reviews || 0}`,
                query_usada: query,
                pipeline_status: 'descoberto',
                score: 75,
                setor: setores[0] || 'Não identificado',
                campanha_id: campanha_id,
                user_id: icp.user_id,
                cnpj: gerarCnpjFicticio(nome, leads.length)
              })
              console.log(`✅ [MAPS] ${nome} | 📱 ${place.phone || 'Sem tel'} | 📍 ${place.address || 'Sem end'}`)
            }
          }

          // Pausa entre queries
          await new Promise(resolve => setTimeout(resolve, 800))
        }

        console.log(`✅ [SERPAPI] Total de empresas: ${leads.length}`)

      } catch (error) {
        const err = error as Error
        console.error('❌ [SERPAPI] ERRO:', err.message)
      }
    }

    // ============ GOOGLE PLACES API COMO COMPLEMENTO ============
    if (leads.length < 20 && GOOGLE_API_KEY) {
      console.log('🗺️ [GOOGLE PLACES] ========== BUSCANDO MAIS EMPRESAS ==========')
      
      try {
        for (const query of searchQueries.slice(0, 5)) {
          if (leads.length >= 50) break
          
          console.log('🔍 [PLACES] Query:', query)
          
          const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=pt-BR`
          
          const placesResponse = await fetch(placesUrl)
          
          if (!placesResponse.ok) {
            console.error('❌ [PLACES] HTTP', placesResponse.status)
            continue
          }

          const placesData = await placesResponse.json()

          if (placesData.status !== 'OK') {
            console.log('⚠️ [PLACES] Status:', placesData.status)
            continue
          }

          console.log(`📍 [PLACES] Resultados: ${placesData.results?.length || 0}`)

          for (const place of (placesData.results || []).slice(0, 10)) {
            const nome = limparNomeEmpresa(place.name)
            
            if (nome && !isEmpresaDuplicada(nome, '')) {
              // Buscar detalhes para telefone
              let telefone = null
              let website = null
              
              if (place.place_id) {
                try {
                  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website&key=${GOOGLE_API_KEY}`
                  const detailsResponse = await fetch(detailsUrl)
                  const detailsData = await detailsResponse.json()
                  
                  if (detailsData.result) {
                    telefone = detailsData.result.formatted_phone_number
                    website = detailsData.result.website
                  }
                } catch (e) {
                  console.log('⚠️ Erro ao buscar detalhes:', e)
                }
              }

              leads.push({
                razao_social: nome,
                nome_fantasia: nome,
                telefone: telefone,
                endereco: place.formatted_address,
                site_url: website,
                cidade: cidade,
                estado: estado,
                fonte: 'google_places',
                fonte_snippet: `Rating: ${place.rating || 'N/A'} | ${place.user_ratings_total || 0} avaliações`,
                query_usada: query,
                pipeline_status: 'descoberto',
                score: telefone ? 80 : 60,
                setor: setores[0] || 'Não identificado',
                campanha_id: campanha_id,
                user_id: icp.user_id,
                cnpj: gerarCnpjFicticio(nome, leads.length)
              })
              console.log(`✅ [PLACES] ${nome} | 📱 ${telefone || 'Sem tel'} | 🌐 ${website || 'Sem site'}`)
            }
          }

          await new Promise(resolve => setTimeout(resolve, 500))
        }

        console.log(`✅ [PLACES] Total após complemento: ${leads.length}`)

      } catch (error) {
        const err = error as Error
        console.error('❌ [PLACES] ERRO:', err.message)
      }
    }

    // ============ SALVAR LEADS ============
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`💾 [SALVAR] NOVOS leads para salvar: ${leads.length}`)
    console.log(`📊 [DB] Leads já existentes: ${leadsExistentes?.length || 0}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    let leadsNovosInseridos = 0
    
    if (leads.length > 0) {
      const { data: insertData, error: insertError } = await supabase
        .from(tabela)
        .insert(leads)
        .select()

      if (insertError) {
        console.error('❌ [DB] Erro ao salvar em lote:', insertError.message)
        
        // Tentar inserir um por um
        for (const lead of leads) {
          const { error: singleError } = await supabase
            .from(tabela)
            .insert(lead)
          
          if (!singleError) {
            leadsNovosInseridos++
          } else {
            console.error('❌ [DB] Erro individual:', singleError.message, '- Lead:', lead.razao_social || lead.nome_fantasia)
          }
        }
        console.log(`✅ [DB] Salvos individualmente: ${leadsNovosInseridos}/${leads.length}`)
      } else {
        leadsNovosInseridos = insertData?.length || leads.length
        console.log(`✅ [DB] ${leadsNovosInseridos} empresas salvas com sucesso`)
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
            descobertos: descobertosAtuais + leadsNovosInseridos,
            enriquecidos: (currentStats?.stats as any)?.enriquecidos || 0,
            qualificados: (currentStats?.stats as any)?.qualificados || 0,
            enviados: (currentStats?.stats as any)?.enviados || 0,
            responderam: (currentStats?.stats as any)?.responderam || 0,
            convertidos: (currentStats?.stats as any)?.convertidos || 0
          }
        })
        .eq('id', campanha_id)
    }

    // Contar TOTAL de leads da campanha no banco
    const { count: totalLeadsCampanha } = await supabase
      .from(tabela)
      .select('*', { count: 'exact', head: true })
      .eq('campanha_id', campanha_id)

    // Contar empresas com telefone
    const empresasComTelefone = leads.filter(l => l.telefone).length

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ [FIM] Busca concluída:')
    console.log(`   📊 NOVOS inseridos agora: ${leadsNovosInseridos}`)
    console.log(`   📊 TOTAL na campanha: ${totalLeadsCampanha}`)
    console.log(`   📱 Com telefone (novos): ${empresasComTelefone}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return new Response(JSON.stringify({
      success: true,
      novos_encontrados: leadsNovosInseridos,
      total_campanha: totalLeadsCampanha || 0,
      total_encontrados: leadsNovosInseridos, // para compatibilidade
      empresas_com_telefone: empresasComTelefone,
      tipo: isB2B ? 'B2B (Empresas)' : 'B2C',
      queries_executadas: searchQueries.length,
      fontes_utilizadas: [...new Set(leads.map(l => l.fonte))],
      debug: {
        serpapi_configured: !!SERPAPI_KEY,
        google_places_configured: !!GOOGLE_API_KEY,
        queries: searchQueries,
        leads_antes: leadsExistentes?.length || 0,
        leads_novos: leadsNovosInseridos,
        leads_total: totalLeadsCampanha
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
