import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mapear setores para termos reais do LinkedIn
const mapSetores: Record<string, string[]> = {
  'agricultura': ['agronegócio', 'agrícola', 'agro', 'fazenda', 'rural'],
  'indústria': ['indústria', 'industrial', 'manufatura', 'fábrica', 'produção'],
  'construção': ['construção', 'engenharia', 'obras', 'incorporação', 'imobiliário'],
  'alimentação': ['alimentos', 'food', 'bebidas', 'restaurante', 'food service'],
  'automotivo': ['automotivo', 'automotive', 'veículos', 'peças', 'autopeças'],
  'tecnologia': ['tecnologia', 'tech', 'software', 'TI', 'digital'],
  'saúde': ['saúde', 'health', 'hospitalar', 'médico', 'farmacêutico'],
  'varejo': ['varejo', 'retail', 'comércio', 'loja', 'e-commerce'],
  'logística': ['logística', 'transporte', 'supply chain', 'distribuição', 'armazém'],
  'energia': ['energia', 'petróleo', 'gás', 'elétrico', 'renovável'],
  'químico': ['químico', 'química', 'petroquímica', 'plástico', 'polímero'],
  'mineração': ['mineração', 'mining', 'minério', 'siderurgia', 'metalurgia'],
  'têxtil': ['têxtil', 'moda', 'confecção', 'vestuário', 'fashion'],
  'papel': ['papel', 'celulose', 'embalagem', 'papelão', 'gráfica'],
  'farmacêutico': ['farmacêutico', 'pharma', 'medicamentos', 'laboratório', 'biopharma']
}

// Cargos relevantes para decisores
const cargosDecisores = [
  'CEO', 'Diretor', 'Gerente', 'Coordenador',
  'Head', 'Supervisor', 'Manager', 'VP',
  'Presidente', 'Sócio', 'Owner', 'Fundador'
]

// Termos de importação/exportação
const termosComex = [
  'importação', 'exportação', 'comex', 
  'comércio exterior', 'trading', 
  'supply chain', 'logística internacional',
  'import', 'export', 'trade'
]

// Funções auxiliares
const extrairCargo = (title: string, snippet: string): string => {
  const titleLower = title.toLowerCase()
  for (const cargo of cargosDecisores) {
    if (titleLower.includes(cargo.toLowerCase())) {
      return cargo
    }
  }
  // Tentar extrair do snippet
  const partes = snippet.split('•')
  if (partes.length > 0) {
    return partes[0]?.trim().substring(0, 50) || 'Não identificado'
  }
  return 'Não identificado'
}

const extrairEmpresa = (title: string): string => {
  // Formato comum: "Nome - Cargo | Empresa"
  const partes = title.split('|')
  if (partes.length > 1) {
    return partes[1].trim().substring(0, 100)
  }
  // Formato alternativo: "Nome - Empresa"
  const partes2 = title.split(' - ')
  if (partes2.length > 1) {
    return partes2[partes2.length - 1].trim().substring(0, 100)
  }
  return 'Não identificado'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log('🚀 [INICIO] Função search-leads V5 - QUERIES OTIMIZADAS CLAUDE')
  
  const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY')
  const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')
  const GOOGLE_CX = Deno.env.get('GOOGLE_CX')

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
    console.log('📋 [ICP CONFIG]', JSON.stringify(icp, null, 2))

    // Extrair configuração - SUPORTE B2B E B2C
    const isB2B = icp.tipo === 'b2b'
    
    // Para B2B: usar setores e cargos
    // Para B2C: usar profissões
    const setores = icp.b2b_config?.setores || icp.filtros_avancados?.setores || []
    const cargosAlvo = icp.b2b_config?.cargos || icp.filtros_avancados?.cargos || cargosDecisores.slice(0, 5)
    const profissao = icp.b2c_config?.profissoes?.[0] || icp.b2c_config?.profissao || ''
    
    const cidade = icp.b2c_config?.cidades?.[0] || icp.b2c_config?.cidade || icp.b2b_config?.cidade || 'Rio de Janeiro'
    const estado = icp.filtros_avancados?.estados?.[0] || icp.b2c_config?.estado || icp.b2b_config?.estado || 'RJ'
    const bairros = icp.b2c_config?.bairros || icp.filtros_avancados?.bairros || ''

    console.log('🎯 [TIPO]', isB2B ? 'B2B' : 'B2C')
    console.log('🎯 [BUSCA] Parâmetros:', { 
      setores: setores.length > 0 ? setores : 'N/A',
      cargos: cargosAlvo,
      profissao: profissao || 'N/A',
      cidade, 
      estado, 
      bairros: bairros || 'Todos' 
    })

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
    const tabela = isB2B ? 'leads_b2b' : 'leads_b2c'
    const { data: leadsExistentes } = await supabase
      .from(tabela)
      .select('linkedin_url, nome_completo, razao_social')
      .eq('campanha_id', campanha_id)

    if (leadsExistentes) {
      for (const lead of leadsExistentes) {
        const nome = lead.nome_completo || lead.razao_social || ''
        if (lead.linkedin_url) {
          leadsUnicos.add(`${nome.toLowerCase().trim()}_${lead.linkedin_url.toLowerCase()}`)
        }
      }
      console.log('📊 [DB] Leads existentes carregados:', leadsExistentes.length)
    }

    // ============ GERAR QUERIES OTIMIZADAS ============
    const gerarQueries = (): string[] => {
      const queries: string[] = []
      const localizacao = `"${cidade}"` // Localização entre aspas para match exato
      
      if (isB2B && setores.length > 0) {
        // MODO B2B: Buscar decisores por setor
        console.log('🔧 [MODO] B2B - Buscando decisores por setor')
        
        const cargosQuery = cargosAlvo.slice(0, 4).join(' OR ')
        const termosComexQuery = termosComex.slice(0, 4).join(' OR ')
        
        for (const setor of setores) {
          const termosSetor = mapSetores[setor.toLowerCase()] || [setor]
          const termoSetorQuery = termosSetor.slice(0, 2).join(' OR ')
          
          // Query 1: Cargo + Comex + Setor + Local
          queries.push(
            `site:linkedin.com/in/ (${cargosQuery}) (${termosComexQuery}) ${termosSetor[0]} ${localizacao}`
          )
          
          // Query 2: Cargo + Setor + Local (mais amplo)
          queries.push(
            `site:linkedin.com/in/ (${cargosQuery}) (${termoSetorQuery}) ${localizacao}`
          )
          
          // Query 3: Só comex + local
          queries.push(
            `site:linkedin.com/in/ (importação OR exportação OR comex) ${termosSetor[0]} ${localizacao}`
          )
        }
        
        // Query genérica comex
        queries.push(
          `site:linkedin.com/in/ (${cargosQuery}) (importação OR exportação) ${localizacao}`
        )
        
      } else if (profissao) {
        // MODO B2C: Buscar por profissão
        console.log('🔧 [MODO] B2C - Buscando por profissão')
        
        if (bairrosList.length > 0) {
          // Busca por cada bairro
          for (const bairro of bairrosList) {
            queries.push(
              `site:linkedin.com/in/ "${profissao}" "${bairro}" ${localizacao}`
            )
          }
        } else {
          // Busca geral na cidade
          queries.push(
            `site:linkedin.com/in/ "${profissao}" ${localizacao} "${estado}"`
          )
          queries.push(
            `site:linkedin.com/in/ "${profissao}" ${localizacao} Brasil`
          )
        }
      } else {
        // Fallback: busca genérica por decisores na localização
        console.log('🔧 [MODO] FALLBACK - Busca genérica de decisores')
        
        queries.push(
          `site:linkedin.com/in/ (CEO OR Diretor OR Gerente) ${localizacao}`
        )
        queries.push(
          `site:linkedin.com/in/ (importação OR exportação) ${localizacao}`
        )
      }
      
      return queries
    }

    const searchQueries = gerarQueries()
    console.log('🔍 [QUERIES] Total geradas:', searchQueries.length)
    searchQueries.forEach((q, i) => console.log(`  Query ${i + 1}:`, q))

    // ============ MÉTODO 1: SERPAPI ============
    if (SERPAPI_KEY && SERPAPI_KEY !== 'undefined' && SERPAPI_KEY.length > 10) {
      console.log('🔍 [SERPAPI] ========== EXECUTANDO QUERIES OTIMIZADAS ==========')
      
      try {
        for (const query of searchQueries) {
          // Se já temos leads suficientes, parar
          if (leads.length >= 30) {
            console.log('✅ [SERPAPI] Limite de 30 leads atingido, parando buscas')
            break
          }
          
          console.log('🔍 [QUERY]', query)
          
          const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&location=Brazil&hl=pt&gl=br&num=50&api_key=${SERPAPI_KEY}`
          
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
          console.log(`📊 [SERPAPI] Resultados brutos: ${results.length}`)
          
          // Filtrar apenas LinkedIn profiles
          const linkedinResults = results.filter((r: any) => 
            r.link?.includes('linkedin.com/in/')
          )
          console.log(`📊 [SERPAPI] LinkedIn profiles: ${linkedinResults.length}`)

          for (const result of linkedinResults) {
            const nome = result.title?.split('-')[0]?.split('|')[0]?.trim() || result.title
            const cargo = extrairCargo(result.title || '', result.snippet || '')
            const empresa = extrairEmpresa(result.title || '')
            
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

              if (isB2B) {
                // Lead B2B
                leads.push({
                  razao_social: empresa !== 'Não identificado' ? empresa : nome,
                  nome_fantasia: empresa,
                  contato_nome: nome,
                  contato_cargo: cargo,
                  contato_linkedin: result.link,
                  cidade: cidade,
                  estado: estado,
                  linkedin_url: result.link,
                  fonte: 'serpapi_v5',
                  fonte_snippet: result.snippet?.substring(0, 300),
                  query_usada: query,
                  pipeline_status: 'descoberto',
                  score: 60,
                  setor: setores[0] || 'Não identificado',
                  campanha_id: campanha_id,
                  user_id: icp.user_id,
                  cnpj: '00000000000000' // Placeholder - será enriquecido depois
                })
              } else {
                // Lead B2C
                leads.push({
                  nome_completo: nome,
                  profissao: profissao || cargo,
                  cidade: cidade,
                  estado: estado,
                  bairro: bairroEncontrado || null,
                  linkedin_url: result.link,
                  fonte: 'serpapi_v5',
                  fonte_snippet: result.snippet?.substring(0, 300),
                  query_usada: query,
                  pipeline_status: 'descoberto',
                  score: 60,
                  campanha_id: campanha_id,
                  user_id: icp.user_id
                })
              }
              
              console.log(`✅ [SERPAPI] Lead: ${nome} | ${cargo} | ${empresa}`)
            }
          }

          // Pausa entre queries para rate limit
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Se encontrou leads com essa query, continuar para variar resultados
          if (linkedinResults.length > 0) {
            console.log(`✅ [SERPAPI] Query bem sucedida: ${linkedinResults.length} perfis`)
          }
        }

        console.log(`✅ [SERPAPI] Total de leads únicos: ${leads.length}`)

      } catch (error) {
        const err = error as Error
        console.error('❌ [SERPAPI] ERRO:', err.message)
      }
    }

    // ============ MÉTODO 2: GOOGLE CSE COMO FALLBACK ============
    if (leads.length < 5 && GOOGLE_API_KEY && GOOGLE_CX) {
      console.log('🔍 [GOOGLE] ========== FALLBACK GOOGLE CSE ==========')
      
      try {
        // Usar apenas as primeiras queries
        const googleQueries = searchQueries.slice(0, 3)
        
        for (const query of googleQueries) {
          if (leads.length >= 30) break
          
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
                const cargo = extrairCargo(item.title || '', item.snippet || '')
                const empresa = extrairEmpresa(item.title || '')
                
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

                  if (isB2B) {
                    leads.push({
                      razao_social: empresa !== 'Não identificado' ? empresa : nome,
                      nome_fantasia: empresa,
                      contato_nome: nome,
                      contato_cargo: cargo,
                      contato_linkedin: item.link,
                      cidade: cidade,
                      estado: estado,
                      linkedin_url: item.link,
                      fonte: 'google_cse_v5',
                      fonte_snippet: item.snippet?.substring(0, 300),
                      query_usada: query,
                      pipeline_status: 'descoberto',
                      score: 50,
                      setor: setores[0] || 'Não identificado',
                      campanha_id: campanha_id,
                      user_id: icp.user_id,
                      cnpj: '00000000000000'
                    })
                  } else {
                    leads.push({
                      nome_completo: nome,
                      profissao: profissao || cargo,
                      cidade: cidade,
                      estado: estado,
                      bairro: bairroEncontrado || null,
                      linkedin_url: item.link,
                      fonte: 'google_cse_v5',
                      fonte_snippet: item.snippet?.substring(0, 300),
                      query_usada: query,
                      pipeline_status: 'descoberto',
                      score: 50,
                      campanha_id: campanha_id,
                      user_id: icp.user_id
                    })
                  }
                  
                  console.log('✅ [GOOGLE] Lead:', nome)
                }
              }
            }
          }

          await new Promise(resolve => setTimeout(resolve, 500))
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
        .from(tabela)
        .insert(leads)
        .select()

      if (insertError) {
        console.error('❌ [DB] Erro ao salvar:', insertError.message)
        
        // Tentar inserir um por um se falhou em lote
        let salvos = 0
        for (const lead of leads) {
          const { error: singleError } = await supabase
            .from(tabela)
            .insert(lead)
          
          if (!singleError) salvos++
          else console.error('❌ [DB] Erro individual:', singleError.message)
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
      tipo: isB2B ? 'B2B' : 'B2C',
      queries_executadas: searchQueries.length,
      bairros_buscados: bairrosList.length > 0 ? bairrosList : ['Todos'],
      debug: {
        serpapi_configured: !!SERPAPI_KEY,
        google_configured: !!(GOOGLE_API_KEY && GOOGLE_CX),
        duplicatas_evitadas: leadsUnicos.size - leads.length,
        queries: searchQueries
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
