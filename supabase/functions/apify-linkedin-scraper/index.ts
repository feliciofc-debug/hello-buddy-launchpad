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
    const { searchQuery, maxResults = 20, location } = await req.json()

    console.log(`🔍 Iniciando busca LinkedIn: "${searchQuery}" (max: ${maxResults})`)

    // Usar o actor powerai~linkedin-peoples-search-scraper que funciona
    const runResponse = await fetch('https://api.apify.com/v2/acts/powerai~linkedin-peoples-search-scraper/runs?waitForFinish=300', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${APIFY_TOKEN}`
      },
      body: JSON.stringify({
        first_name: searchQuery.split(' ')[0] || searchQuery,
        last_name: searchQuery.split(' ').slice(1).join(' ') || '',
        company: '',
        title: '',
        industry: '',
        maxResults: maxResults
      })
    })

    if (!runResponse.ok) {
      const errorText = await runResponse.text()
      console.error('❌ Erro Apify:', errorText)
      return new Response(JSON.stringify({
        error: 'Erro ao iniciar busca no LinkedIn',
        details: errorText
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const runData = await runResponse.json()
    console.log(`✅ Run iniciada:`, runData.data?.id)

    const runId = runData.data?.id

    if (!runId) {
      return new Response(JSON.stringify({
        error: 'Não foi possível obter ID da execução'
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Buscar resultados do dataset
    const resultsResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items`, {
      headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
    })

    const results = await resultsResponse.json()
    console.log(`📊 Resultados encontrados: ${results.length}`)

    // Processar e estruturar dados
    const leads = results.map((profile: any) => ({
      nome_completo: profile.fullName || profile.name || 'Nome não disponível',
      profissao: profile.headline || profile.title || profile.occupation,
      cidade: profile.location?.split(',')[0] || profile.city,
      estado: profile.location?.split(',')[1]?.trim() || profile.state,
      linkedin_url: profile.profileUrl || profile.url || profile.linkedinUrl,
      linkedin_id: profile.publicIdentifier || profile.profileId,
      email: profile.email || null,
      telefone: profile.phoneNumber || profile.phone || null,
      empresa_atual: profile.companyName || profile.company,
      cargo_atual: profile.title || profile.position,
      especialidade: profile.headline,
      foto_url: profile.profilePicture || profile.photoUrl,
      conexoes: profile.connectionsCount || profile.connections,
      verified: true,
      fonte: 'linkedin_apify',
      raw_data: profile
    }))

    return new Response(JSON.stringify({
      success: true,
      count: leads.length,
      leads: leads
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('❌ Erro Apify LinkedIn:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(JSON.stringify({
      error: errorMessage
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
