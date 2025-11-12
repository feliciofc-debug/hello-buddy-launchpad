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
      console.warn('⚠️ Google API não configurada, usando dados mockados')
      
      const enrichmentData = {
        linkedin_url: null,
        instagram_username: null,
        news_mentions: [],
        diario_oficial: [],
        enriched_at: new Date().toISOString()
      }

      await supabaseClient
        .from('socios')
        .update({ enrichment_data: enrichmentData })
        .eq('id', socio_id)

      await supabaseClient
        .from('enrichment_queue')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('socio_id', socio_id)

      await supabaseClient
        .from('qualification_queue')
        .insert({ socio_id, status: 'pending' })

      return new Response(
        JSON.stringify({ success: true, message: 'Enriquecimento sem Google API' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Helper: Google Custom Search
    const googleSearch = async (query: string) => {
      try {
        const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}`
        const response = await fetch(url)
        
        if (!response.ok) {
          console.error(`Google Search error: ${response.status}`)
          return { items: [] }
        }
        
        return await response.json()
      } catch (error) {
        console.error('Google Search failed:', error)
        return { items: [] }
      }
    }

    console.log('🔍 Buscando LinkedIn...')
    const linkedinResults = await googleSearch(
      `${socio.nome} ${socio.empresa.nome_fantasia} site:linkedin.com/in/`
    )
    const linkedinUrl = linkedinResults.items?.[0]?.link || null
    const linkedinSnippet = linkedinResults.items?.[0]?.snippet || null

    console.log('📸 Buscando Instagram...')
    const instagramResults = await googleSearch(
      `${socio.nome} instagram`
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
    const newsResults = await googleSearch(
      `${socio.nome} ${socio.empresa.razao_social} -faleceu -morreu`
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

  } catch (error: any) {
    console.error('❌ ERRO:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
