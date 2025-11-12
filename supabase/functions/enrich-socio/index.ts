import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('🔍 enrich-socio INICIADO (VERSÃO COMPLETA)')

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { socio_id } = await req.json()
    if (!socio_id) throw new Error('socio_id required')

    console.log(`🔍 Buscando sócio: ${socio_id}`)

    // Buscar sócio
    const { data: socio } = await supabaseClient
      .from('socios')
      .select('*, empresa:empresas(*)')
      .eq('id', socio_id)
      .single()

    if (!socio) throw new Error('Sócio não encontrado')

    console.log(`✅ Sócio: ${socio.nome}`)

    // Google API
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')
    const GOOGLE_CX = Deno.env.get('GOOGLE_CX')

    if (!GOOGLE_API_KEY || !GOOGLE_CX) {
      console.error('❌ Google API não configurada')
      
      await supabaseClient
        .from('enrichment_queue')
        .update({ 
          status: 'failed', 
          processed_at: new Date().toISOString(),
          error_message: 'Google API não configurada. Configure GOOGLE_API_KEY e GOOGLE_CX no backend.'
        })
        .eq('socio_id', socio_id)

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'ERRO: Credenciais Google não configuradas.\n\n🔧 Solução:\n1. Acesse: https://console.cloud.google.com/apis/credentials\n2. Crie uma API Key\n3. Ative "Custom Search API"\n4. Configure GOOGLE_API_KEY no backend\n5. Crie um Search Engine em: https://programmablesearchengine.google.com/\n6. Configure GOOGLE_CX com o ID do Search Engine' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar formato das credenciais
    console.log('🔐 Validando credenciais Google...')
    console.log(`GOOGLE_API_KEY: ${GOOGLE_API_KEY.substring(0, 10)}...`)
    console.log(`GOOGLE_CX: ${GOOGLE_CX}`)

    // Teste simples da API
    try {
      const testUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=test`
      const testResponse = await fetch(testUrl)
      
      if (!testResponse.ok) {
        const errorData = await testResponse.json()
        console.error('❌ Teste Google API falhou:', errorData)
        
        let errorMessage = 'ERRO: Credenciais Google inválidas.\n\n'
        
        if (testResponse.status === 400) {
          errorMessage += '🔴 Erro 400: Parâmetros inválidos\n'
          errorMessage += '• Verifique se o GOOGLE_CX está correto\n'
          errorMessage += '• O CX deve estar no formato: 0123456789abcdefg:hijklmnop\n'
          errorMessage += `• CX atual: ${GOOGLE_CX}\n\n`
        } else if (testResponse.status === 403) {
          errorMessage += '🔴 Erro 403: Acesso negado\n'
          errorMessage += '• Verifique se a API Key está ativa\n'
          errorMessage += '• Certifique-se que "Custom Search API" está habilitada\n\n'
        } else if (testResponse.status === 429) {
          errorMessage += '🔴 Erro 429: Cota excedida\n'
          errorMessage += '• Você atingiu o limite de 100 buscas/dia (plano free)\n\n'
        }
        
        errorMessage += `Detalhes técnicos: ${JSON.stringify(errorData, null, 2)}`
        
        await supabaseClient
          .from('enrichment_queue')
          .update({ 
            status: 'failed', 
            processed_at: new Date().toISOString(),
            error_message: errorMessage
          })
          .eq('socio_id', socio_id)

        return new Response(
          JSON.stringify({ success: false, error: errorMessage }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log('✅ Credenciais Google validadas com sucesso!')
    } catch (testError: any) {
      console.error('❌ Erro ao testar Google API:', testError)
      
      const errorMessage = `ERRO: Não foi possível conectar ao Google API.\n\n${testError.message}`
      
      await supabaseClient
        .from('enrichment_queue')
        .update({ 
          status: 'failed', 
          processed_at: new Date().toISOString(),
          error_message: errorMessage
        })
        .eq('socio_id', socio_id)

      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Helper: Google Custom Search
    const googleSearch = async (query: string) => {
      try {
        const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}`
        console.log(`🔍 Google Search: ${query}`)
        const response = await fetch(url)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`❌ Google Search error ${response.status}:`, errorText)
          throw new Error(`Google API error ${response.status}: ${errorText}`)
        }
        
        const data = await response.json()
        console.log(`✅ Google Search OK: ${data.items?.length || 0} resultados`)
        return data
      } catch (error) {
        console.error('❌ Google Search failed:', error)
        throw error
      }
    }

    try {
      // Usar razão_social (ATOM BRASIL DIGITAL) ao invés de nome_fantasia (ATACADISTA DIGITAL)
      const empresaNome = socio.empresa.razao_social.replace(' LTDA', '').trim()
      
      console.log('🔍 Buscando LinkedIn...')
      console.log(`Query: ${socio.nome} ${empresaNome} site:linkedin.com/in/`)
      const linkedinResults = await googleSearch(
        `${socio.nome} ${empresaNome} site:linkedin.com/in/`
      )
      const linkedinUrl = linkedinResults.items?.[0]?.link || null
      const linkedinSnippet = linkedinResults.items?.[0]?.snippet || null

      console.log('📸 Buscando Instagram...')
      console.log(`Query: ${socio.nome} ${empresaNome} instagram`)
      const instagramResults = await googleSearch(
        `${socio.nome} ${empresaNome} instagram`
      )
      let instagramUsername = null
      for (const item of instagramResults.items || []) {
        const match = item.link?.match(/instagram\.com\/([^\/\?]+)/)
        if (match && match[1] !== 'p') {
          instagramUsername = match[1]
          break
        }
      }

      console.log('📰 Buscando notícias...')
      console.log(`Query: ${socio.nome} ${empresaNome} -faleceu -morreu`)
      const newsResults = await googleSearch(
        `${socio.nome} ${empresaNome} -faleceu -morreu`
      )
      const newsMentions = (newsResults.items || []).slice(0, 5).map((item: any) => ({
        titulo: item.title,
        snippet: item.snippet,
        url: item.link,
        data: item.pagemap?.metatags?.[0]?.['article:published_time']
      }))

      console.log('🏛️ Buscando Diário Oficial...')
      const diarioResults = await googleSearch(
        `${socio.empresa.razao_social} site:in.gov.br OR site:imprensaoficial.com.br`
      )
      const diarioOficial = (diarioResults.items || []).slice(0, 3).map((item: any) => ({
        titulo: item.title,
        snippet: item.snippet,
        url: item.link
      }))

      const enrichmentData = {
        linkedin_url: linkedinUrl,
        linkedin_snippet: linkedinSnippet,
        instagram_username: instagramUsername,
        news_mentions: newsMentions,
        diario_oficial: diarioOficial,
        enriched_at: new Date().toISOString()
      }

      console.log('💾 Salvando dados enriquecidos...')
      console.log('LinkedIn:', linkedinUrl)
      console.log('Instagram:', instagramUsername)
      console.log('Notícias:', newsMentions.length)

      // Verificar se encontrou ALGUM dado relevante
      const temDados = linkedinUrl || instagramUsername || newsMentions.length > 0
      
      if (!temDados) {
        console.warn('⚠️ Nenhum dado relevante encontrado no Google')
      }

      await supabaseClient
        .from('socios')
        .update({ enrichment_data: enrichmentData })
        .eq('id', socio_id)

      // Atualizar queue
      await supabaseClient
        .from('enrichment_queue')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('socio_id', socio_id)

      // Adicionar na qualification_queue
      await supabaseClient
        .from('qualification_queue')
        .insert({ socio_id, status: 'pending' })

      console.log('✅ Enriquecimento completo!')

      return new Response(
        JSON.stringify({ success: true, enrichment: enrichmentData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (searchError: any) {
      console.error('❌ Erro no Google Search:', searchError)
      
      await supabaseClient
        .from('enrichment_queue')
        .update({ 
          status: 'failed', 
          processed_at: new Date().toISOString(),
          error_message: `Google Search falhou: ${searchError.message}`
        })
        .eq('socio_id', socio_id)

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Google Search falhou: ${searchError.message}` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error: any) {
    console.error('❌ ERRO:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
