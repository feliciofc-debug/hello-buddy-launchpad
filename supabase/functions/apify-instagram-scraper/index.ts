import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const APIFY_TOKEN = Deno.env.get('APIFY_API_KEY')

  if (!APIFY_TOKEN) {
    return new Response(JSON.stringify({
      error: 'APIFY_API_KEY não configurada'
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const { hashtag, searchQuery, maxResults = 30 } = await req.json()

    console.log(`🔍 Iniciando busca Instagram: hashtag="${hashtag}" query="${searchQuery}"`)

    // Usar actor de perfis de Instagram
    const runResponse = await fetch('https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs?waitForFinish=300', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${APIFY_TOKEN}`
      },
      body: JSON.stringify({
        search: searchQuery || hashtag,
        searchType: 'hashtag',
        resultsLimit: maxResults,
        proxy: {
          useApifyProxy: true
        }
      })
    })

    if (!runResponse.ok) {
      const errorText = await runResponse.text()
      console.error('❌ Erro Apify Instagram:', errorText)
      return new Response(JSON.stringify({
        error: 'Erro ao iniciar busca no Instagram',
        details: errorText
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const runData = await runResponse.json()
    const runId = runData.data?.id

    console.log(`✅ Run Instagram iniciada:`, runId)

    if (!runId) {
      return new Response(JSON.stringify({
        error: 'Não foi possível obter ID da execução'
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Buscar resultados
    const resultsResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items`, {
      headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
    })

    const results = await resultsResponse.json()
    console.log(`📊 Perfis Instagram encontrados: ${results.length}`)

    // Filtrar apenas contas business ou verificadas
    const leads = results
      .filter((profile: any) => profile.isBusinessAccount || profile.isVerified || profile.followersCount > 1000)
      .map((profile: any) => ({
        nome_completo: profile.fullName || profile.username,
        instagram_username: profile.username,
        instagram_url: `https://instagram.com/${profile.username}`,
        instagram_id: profile.id,
        biografia: profile.biography,
        seguidores: profile.followersCount,
        categoria_negocio: profile.businessCategoryName,
        telefone: profile.businessPhoneNumber || profile.publicPhoneNumber,
        email: profile.businessEmail || profile.publicEmail,
        website: profile.externalUrl,
        cidade: profile.businessAddressJson?.city,
        is_business: profile.isBusinessAccount,
        is_verified: profile.isVerified,
        verified: profile.isVerified || profile.isBusinessAccount,
        fonte: 'instagram_apify',
        raw_data: profile
      }))

    return new Response(JSON.stringify({
      success: true,
      count: leads.length,
      leads: leads
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('❌ Erro Apify Instagram:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(JSON.stringify({
      error: errorMessage
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
