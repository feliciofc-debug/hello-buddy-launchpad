import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const APIFY_TOKEN = Deno.env.get('APIFY_API_KEY')
  const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY')
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const body = await req.json()
    const { acao } = body
    const userId = req.headers.get('x-user-id')

    console.log(`🎯 Ação: ${acao}`, body)

    // ETAPA 1: BUSCAR CORRETORAS
    if (acao === 'buscar_corretoras') {
      const { bairros, cidade, estado } = body
      if (!APIFY_TOKEN) return new Response(JSON.stringify({ error: 'APIFY_API_KEY não configurada' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      const searchQueries = bairros.map((b: string) => `imobiliária ${b} ${cidade} ${estado}`)
      const runResponse = await fetch('https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/runs?waitForFinish=120', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${APIFY_TOKEN}` },
        body: JSON.stringify({ searchStringsArray: searchQueries, maxCrawledPlacesPerSearch: 15, language: 'pt-BR' })
      })

      const runData = await runResponse.json()
      const datasetId = runData.data?.defaultDatasetId
      if (!datasetId) return new Response(JSON.stringify({ corretoras: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      const resultsResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items`, { headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` } })
      const places = await resultsResponse.json()

      const corretoras = places.filter((p: any) => p.title?.toLowerCase().match(/imobili|corretora|imóveis|imoveis/)).map((place: any) => {
        let instagram_username = null
        if (place.website) { const m = place.website.match(/instagram\.com\/([a-zA-Z0-9_.]+)/i); if (m) instagram_username = m[1] }
        if (!instagram_username && place.socialUrls) { const ig = place.socialUrls.find((u: string) => u.includes('instagram')); if (ig) { const m = ig.match(/instagram\.com\/([^\/\?]+)/); if (m) instagram_username = m[1] } }
        return { nome: place.title, endereco: place.address, instagram_username, instagram_url: instagram_username ? `https://instagram.com/${instagram_username}` : null, seguidores_count: null }
      })

      return new Response(JSON.stringify({ success: true, corretoras }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ETAPA 2: BUSCAR SEGUIDORES
    if (acao === 'buscar_seguidores') {
      const { instagram_username, max_seguidores, imobiliaria_nome } = body
      if (!APIFY_TOKEN) return new Response(JSON.stringify({ error: 'APIFY_API_KEY não configurada' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      const runResponse = await fetch('https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs?waitForFinish=300', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${APIFY_TOKEN}` },
        body: JSON.stringify({ usernames: [instagram_username], resultsLimit: max_seguidores || 300 })
      })

      const runData = await runResponse.json()
      const datasetId = runData.data?.defaultDatasetId
      if (!datasetId) return new Response(JSON.stringify({ seguidores: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      const resultsResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items`, { headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` } })
      const profiles = await resultsResponse.json()

      const seguidores = profiles.slice(0, max_seguidores || 300).map((p: any) => {
        const bio = p.biography || ''
        return {
          id: crypto.randomUUID(), user_id: userId, instagram_username: p.username, instagram_url: `https://instagram.com/${p.username}`,
          nome_completo: p.fullName, foto_url: p.profilePicUrl, bio: bio.substring(0, 500), seguidores: p.followersCount || 0,
          cidade_detectada: bio.toLowerCase().includes('rio') ? 'Rio de Janeiro' : null, estado_detectado: bio.toLowerCase().includes('rj') ? 'RJ' : null,
          seguindo_imobiliaria: imobiliaria_nome, score_total: 0, qualificacao: 'NOVO', status: 'novo'
        }
      })

      if (userId && seguidores.length > 0) {
        for (const s of seguidores) {
          await supabase.from('seguidores_concorrentes').upsert({ ...s, created_at: new Date().toISOString() }, { onConflict: 'instagram_username', ignoreDuplicates: true })
        }
      }

      return new Response(JSON.stringify({ success: true, count: seguidores.length, seguidores }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ETAPA 3: BUSCAR LINKEDIN
    if (acao === 'buscar_linkedin') {
      const { nome, cidade, estado } = body
      if (!SERPAPI_KEY) return new Response(JSON.stringify({ error: 'SERPAPI_KEY não configurada' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      const query = `${nome} ${cidade || ''} ${estado || ''} site:linkedin.com/in/`
      const response = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}&num=5`)
      const data = await response.json()

      let linkedin_url = null, cargo = null, empresa = null
      if (data.organic_results?.length > 0) {
        const result = data.organic_results.find((r: any) => r.link?.includes('linkedin.com/in/'))
        if (result) { linkedin_url = result.link; const parts = (result.snippet || '').split(' - '); if (parts.length >= 2) { cargo = parts[0]; empresa = parts[1] } }
      }

      return new Response(JSON.stringify({ success: !!linkedin_url, linkedin_url, cargo, empresa }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Ação não reconhecida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('❌ Erro:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
