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

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { socio_id } = await req.json()

    if (!socio_id) {
      throw new Error('socio_id is required')
    }

    console.log(`✨ Enriching socio: ${socio_id}`)

    // Fetch socio with empresa data
    const { data: socio, error: socioError } = await supabaseClient
      .from('socios')
      .select('*, empresa:empresas(*)')
      .eq('id', socio_id)
      .single()

    if (socioError || !socio) throw new Error('Socio not found')

    // Google API Key (SEGURA NO SERVIDOR!)
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')
    const GOOGLE_CX = Deno.env.get('GOOGLE_CX')

    if (!GOOGLE_API_KEY || !GOOGLE_CX) {
      throw new Error('Google API credentials not configured')
    }

    // Helper function for Google Custom Search
    const googleSearch = async (query: string) => {
      const params = new URLSearchParams({
        key: GOOGLE_API_KEY,
        cx: GOOGLE_CX,
        q: query,
      })

      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?${params}`
      )

      if (!response.ok) {
        console.error(`Google API error: ${response.status}`)
        return { items: [] }
      }

      return await response.json()
    }

    // Find LinkedIn
    const findLinkedIn = async (name: string, company: string) => {
      const query = `${name} ${company} site:linkedin.com/in/`
      const results = await googleSearch(query)

      if (results.items && results.items.length > 0) {
        const url = results.items[0].link
        const username = url.match(/linkedin\.com\/in\/([^\/\?]+)/)?.[1]

        return {
          url,
          username,
          foto: results.items[0].pagemap?.cse_image?.[0]?.src,
          snippet: results.items[0].snippet,
        }
      }
      return null
    }

    // Find Instagram
    const findInstagram = async (name: string) => {
      const query = `${name} instagram`
      const results = await googleSearch(query)

      for (const item of results.items || []) {
        const match = item.link.match(/instagram\.com\/([^\/\?]+)/)
        if (match) {
          return {
            username: match[1],
            url: item.link,
            bio: item.snippet,
          }
        }
      }
      return null
    }

    // Find news mentions
    const findNews = async (name: string) => {
      const query = `${name} -obituário -falecimento`
      const results = await googleSearch(query)

      return (results.items || []).slice(0, 5).map((item: any) => ({
        titulo: item.title,
        snippet: item.snippet,
        url: item.link,
        data: item.pagemap?.metatags?.[0]?.['article:published_time'],
      }))
    }

    // Search Diário Oficial
    const searchDiarioOficial = async (companyName: string) => {
      const query = `${companyName} site:in.gov.br OR site:imprensaoficial.com.br`
      const results = await googleSearch(query)

      return (results.items || []).map((item: any) => ({
        tipo: 'diario_oficial',
        titulo: item.title,
        conteudo: item.snippet,
        url: item.link,
      }))
    }

    // Run all enrichment in parallel
    const [linkedin, instagram, news, diarioOficial] = await Promise.allSettled([
      findLinkedIn(socio.nome, socio.empresa.nome_fantasia),
      findInstagram(socio.nome),
      findNews(socio.nome),
      searchDiarioOficial(socio.empresa.razao_social),
    ])

    // Prepare enrichment data
    const enrichmentData = {
      socio_id,
      linkedin_url: linkedin.status === 'fulfilled' ? linkedin.value?.url : null,
      linkedin_username: linkedin.status === 'fulfilled' ? linkedin.value?.username : null,
      linkedin_foto: linkedin.status === 'fulfilled' ? linkedin.value?.foto : null,
      linkedin_snippet: linkedin.status === 'fulfilled' ? linkedin.value?.snippet : null,
      instagram_username: instagram.status === 'fulfilled' ? instagram.value?.username : null,
      instagram_url: instagram.status === 'fulfilled' ? instagram.value?.url : null,
      instagram_bio: instagram.status === 'fulfilled' ? instagram.value?.bio : null,
      news_mentions: news.status === 'fulfilled' ? news.value : [],
      diario_oficial: diarioOficial.status === 'fulfilled' ? diarioOficial.value : [],
    }

    // Save enrichment data
    const { data: enriched, error: enrichError } = await supabaseClient
      .from('socios_enriquecidos')
      .upsert(enrichmentData)
      .select()
      .single()

    if (enrichError) throw enrichError

    // Update queue status
    await supabaseClient
      .from('enrichment_queue')
      .update({ status: 'completed', processado_em: new Date().toISOString() })
      .eq('socio_id', socio_id)

    // Add to qualification queue
    await supabaseClient.from('qualification_queue').insert({
      socio_id,
      status: 'pending',
    })

    console.log(`✅ Enriched: ${socio.nome}`)

    return new Response(
      JSON.stringify({ success: true, enrichment: enriched }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
