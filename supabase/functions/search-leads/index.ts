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

  console.log('🚀 [INICIO] Função search-leads V3 DEBUG iniciada')
  
  // Verificar secrets ANTES de tudo
  const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY')
  const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')
  const GOOGLE_CX = Deno.env.get('GOOGLE_CX')
  const APIFY_API_TOKEN = Deno.env.get('APIFY_API_KEY')

  console.log('🔑 [SECRETS] Verificando configuração:')
  console.log('🔑 SERPAPI_KEY:', SERPAPI_KEY ? `CONFIGURADO (${SERPAPI_KEY.substring(0, 8)}...)` : '❌ NÃO CONFIGURADO')
  console.log('🔑 GOOGLE_API_KEY:', GOOGLE_API_KEY ? `CONFIGURADO (${GOOGLE_API_KEY.substring(0, 8)}...)` : '❌ NÃO CONFIGURADO')
  console.log('🔑 GOOGLE_CX:', GOOGLE_CX ? `CONFIGURADO (${GOOGLE_CX.substring(0, 8)}...)` : '❌ NÃO CONFIGURADO')
  console.log('🔑 APIFY_API_KEY:', APIFY_API_TOKEN ? `CONFIGURADO (${APIFY_API_TOKEN.substring(0, 8)}...)` : '❌ NÃO CONFIGURADO')
  
  try {
    const body = await req.json()
    console.log('📦 [BODY] Dados recebidos:', JSON.stringify(body, null, 2))

    const { campanha_id, icp_config_id } = body

    if (!campanha_id || !icp_config_id) {
      throw new Error('campanha_id e icp_config_id são obrigatórios')
    }

    // Conectar Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Buscar ICP
    console.log('🔍 [DB] Buscando ICP:', icp_config_id)
    const { data: icp, error: icpError } = await supabase
      .from('icp_configs')
      .select('*')
      .eq('id', icp_config_id)
      .single()

    if (icpError || !icp) {
      console.error('❌ [DB] Erro ao buscar ICP:', icpError)
      throw new Error('ICP não encontrado')
    }

    console.log('✅ [ICP] ICP encontrado:', icp.nome)
    console.log('📋 [ICP] b2c_config:', JSON.stringify(icp.b2c_config, null, 2))
    console.log('📋 [ICP] filtros_avancados:', JSON.stringify(icp.filtros_avancados, null, 2))

    // Extrair dados do ICP - suportar múltiplos formatos
    const profissao = icp.b2c_config?.profissoes?.[0] || icp.b2c_config?.profissao || 'médico'
    const cidade = icp.b2c_config?.cidades?.[0] || icp.b2c_config?.cidade || 
                   (icp.filtros_avancados?.estados?.[0] === 'RJ' ? 'Rio de Janeiro' : 'São Paulo')
    const estado = icp.filtros_avancados?.estados?.[0] || icp.b2c_config?.estado || 'RJ'

    console.log(`🎯 [BUSCA] Parâmetros extraídos: profissao="${profissao}", cidade="${cidade}", estado="${estado}"`)

    let leads: any[] = []
    
    // ============ MÉTODO 1: SERPAPI ============
    if (SERPAPI_KEY && SERPAPI_KEY !== 'undefined' && SERPAPI_KEY.length > 10) {
      console.log('🔍 [SERPAPI] ========== INICIANDO SERPAPI ==========')
      
      try {
        const query = `site:linkedin.com/in "${profissao}" "${cidade}"`
        console.log('🔍 [SERPAPI] Query:', query)
        
        const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&location=Brazil&hl=pt&gl=br&num=20&api_key=${SERPAPI_KEY}`
        console.log('🌐 [SERPAPI] URL construída (key oculta)')
        
        console.log('⏳ [SERPAPI] Iniciando fetch...')
        const startTime = Date.now()
        
        const serpResponse = await fetch(serpUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        
        const fetchTime = Date.now() - startTime
        console.log(`📡 [SERPAPI] Fetch completado em ${fetchTime}ms`)
        console.log('📡 [SERPAPI] Status HTTP:', serpResponse.status)
        console.log('📡 [SERPAPI] Status Text:', serpResponse.statusText)

        const serpText = await serpResponse.text()
        console.log('📄 [SERPAPI] Tamanho da resposta:', serpText.length, 'bytes')
        console.log('📄 [SERPAPI] Primeiros 800 chars:', serpText.substring(0, 800))

        if (!serpResponse.ok) {
          console.error('❌ [SERPAPI] Resposta não OK:', serpText.substring(0, 500))
          throw new Error(`SerpAPI HTTP ${serpResponse.status}: ${serpText.substring(0, 200)}`)
        }

        let serpData
        try {
          serpData = JSON.parse(serpText)
          console.log('✅ [SERPAPI] JSON parseado com sucesso')
        } catch (e) {
          const err = e as Error
          console.error('❌ [SERPAPI] Erro ao fazer parse JSON:', err.message)
          console.log('📄 [SERPAPI] Texto que falhou parse:', serpText.substring(0, 1000))
          throw new Error('Resposta SerpAPI não é JSON válido')
        }

        console.log('📊 [SERPAPI] Keys na resposta:', Object.keys(serpData))
        
        if (serpData.error) {
          console.error('❌ [SERPAPI] Erro retornado pela API:', serpData.error)
          throw new Error(`SerpAPI error: ${serpData.error}`)
        }

        if (serpData.search_metadata) {
          console.log('📊 [SERPAPI] search_metadata:', JSON.stringify(serpData.search_metadata, null, 2))
        }

        const results = serpData.organic_results || []
        console.log(`📊 [SERPAPI] organic_results encontrados: ${results.length}`)

        if (results.length > 0) {
          console.log('📋 [SERPAPI] Primeiro resultado:', JSON.stringify(results[0], null, 2))
        } else {
          console.log('⚠️ [SERPAPI] Nenhum organic_results encontrado')
          if (serpData.search_information) {
            console.log('📊 [SERPAPI] search_information:', JSON.stringify(serpData.search_information, null, 2))
          }
        }

        // Processar resultados
        for (const result of results) {
          if (result.link && result.link.includes('linkedin.com/in/')) {
            const nome = result.title?.split('-')[0]?.split('|')[0]?.trim() || result.title
            
            if (nome && nome.length >= 3) {
              leads.push({
                nome_completo: nome,
                profissao: profissao,
                cidade: cidade,
                estado: estado,
                linkedin_url: result.link,
                fonte: 'serpapi',
                fonte_snippet: result.snippet?.substring(0, 300),
                query_usada: query,
                pipeline_status: 'descoberto',
                score: 60,
                campanha_id: campanha_id,
                user_id: icp.user_id
              })
              console.log('✅ [SERPAPI] Lead adicionado:', nome)
            }
          }
        }

        console.log(`✅ [SERPAPI] Total de leads via SerpAPI: ${leads.length}`)

      } catch (error) {
        const err = error as Error
        console.error('❌ [SERPAPI] ERRO COMPLETO:', err)
        console.error('❌ [SERPAPI] Error message:', err.message)
        console.error('❌ [SERPAPI] Error stack:', err.stack)
      }
    } else {
      console.log('⚠️ [SERPAPI] SERPAPI_KEY não configurado ou inválido')
      console.log('⚠️ [SERPAPI] Valor atual:', SERPAPI_KEY ? `"${SERPAPI_KEY.substring(0,5)}..." (${SERPAPI_KEY.length} chars)` : 'undefined/null')
    }

    // ============ MÉTODO 2: GOOGLE CSE ============
    if (leads.length === 0 && GOOGLE_API_KEY && GOOGLE_CX) {
      console.log('🔍 [GOOGLE] ========== INICIANDO GOOGLE CSE ==========')
      
      try {
        const query = `"${profissao}" "${cidade}" linkedin.com/in`
        console.log('🔍 [GOOGLE] Query:', query)
        
        const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}&num=10`
        
        console.log('⏳ [GOOGLE] Iniciando fetch...')
        const googleResponse = await fetch(googleUrl)
        
        console.log('📡 [GOOGLE] Status:', googleResponse.status)
        
        const googleText = await googleResponse.text()
        console.log('📄 [GOOGLE] Primeiros 500 chars:', googleText.substring(0, 500))

        let googleData
        try {
          googleData = JSON.parse(googleText)
        } catch (e) {
          const err = e as Error
          console.error('❌ [GOOGLE] Erro ao fazer parse JSON:', err.message)
          throw new Error('Resposta Google não é JSON válido')
        }

        console.log('📊 [GOOGLE] Keys:', Object.keys(googleData))
        console.log('📊 [GOOGLE] items count:', googleData.items?.length || 0)

        if (googleData.error) {
          console.error('❌ [GOOGLE] Erro da API:', JSON.stringify(googleData.error))
        }

        if (googleData.items) {
          for (const item of googleData.items) {
            if (item.link?.includes('linkedin.com/in/')) {
              const nome = item.title?.split('-')[0]?.trim()
              
              if (nome && nome.length >= 3) {
                leads.push({
                  nome_completo: nome,
                  profissao: profissao,
                  cidade: cidade,
                  estado: estado,
                  linkedin_url: item.link,
                  fonte: 'google_cse',
                  fonte_snippet: item.snippet?.substring(0, 300),
                  query_usada: query,
                  pipeline_status: 'descoberto',
                  score: 50,
                  campanha_id: campanha_id,
                  user_id: icp.user_id
                })
                console.log('✅ [GOOGLE] Lead adicionado:', nome)
              }
            }
          }
        }

        console.log(`✅ [GOOGLE] Total de leads via Google: ${leads.length}`)

      } catch (error) {
        const err = error as Error
        console.error('❌ [GOOGLE] ERRO:', err.message)
      }
    }

    // ============ MÉTODO 3: APIFY ============
    if (leads.length === 0 && APIFY_API_TOKEN) {
      console.log('🔍 [APIFY] ========== INICIANDO APIFY ==========')
      console.log('⚠️ [APIFY] SerpAPI/Google falharam, usando Apify como fallback')
    }

    // ============ SALVAR LEADS ============
    console.log(`💾 [SALVAR] Total de leads para salvar: ${leads.length}`)

    if (leads.length > 0) {
      console.log('💾 [SALVAR] Inserindo leads no banco...')
      
      const { data: insertData, error: insertError } = await supabase
        .from('leads_b2c')
        .insert(leads)
        .select()

      if (insertError) {
        console.error('❌ [DB] Erro ao salvar leads:', JSON.stringify(insertError))
      } else {
        console.log(`✅ [DB] ${leads.length} leads salvos com sucesso`)
      }

      // Atualizar stats da campanha
      await supabase
        .from('campanhas_prospeccao')
        .update({
          stats: {
            descobertos: leads.length,
            enriquecidos: 0,
            qualificados: 0,
            enviados: 0,
            responderam: 0,
            convertidos: 0
          }
        })
        .eq('id', campanha_id)
    }

    console.log('✅ [FIM] Busca concluída com', leads.length, 'leads')

    return new Response(JSON.stringify({
      success: true,
      leads_encontrados: leads.length,
      fonte: leads[0]?.fonte || 'nenhuma',
      debug: {
        serpapi_configured: !!SERPAPI_KEY,
        google_configured: !!(GOOGLE_API_KEY && GOOGLE_CX),
        apify_configured: !!APIFY_API_TOKEN
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    const err = error as Error
    console.error('❌ [ERRO FATAL]', err.message)
    console.error('❌ [STACK]', err.stack)
    
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
      stack: err.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
