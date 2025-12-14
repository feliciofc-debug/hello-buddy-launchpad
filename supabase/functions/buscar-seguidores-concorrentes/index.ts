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
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  if (!APIFY_TOKEN) {
    return new Response(JSON.stringify({ error: 'APIFY_API_KEY não configurada' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    const userId = req.headers.get('x-user-id')
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { modo, estado, cidade, bairros, perfis, maxSeguidores = 300 } = body

    console.log('📸 Iniciando busca de seguidores:', { modo, estado, cidade, bairros, perfis })

    let instagramUsernames: string[] = []

    if (modo === 'manual' && perfis?.length > 0) {
      // Modo manual: usa os perfis fornecidos
      instagramUsernames = perfis
      console.log('📝 Modo manual, perfis:', instagramUsernames)
    } else if (modo === 'automatico') {
      // Modo automático: buscar corretoras na região via Google Maps
      console.log('🔍 Modo automático - buscando corretoras...')
      
      const searchQueries = bairros?.map((b: string) => `imobiliária ${b} ${cidade} ${estado}`) || []
      
      // Buscar corretoras no Google Maps via Apify
      const mapsResponse = await fetch('https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/runs?waitForFinish=120', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APIFY_TOKEN}`
        },
        body: JSON.stringify({
          searchStringsArray: searchQueries.slice(0, 5), // Limitar a 5 bairros
          maxCrawledPlacesPerSearch: 10,
          language: 'pt-BR',
          maxReviews: 0
        })
      })

      if (mapsResponse.ok) {
        const mapsData = await mapsResponse.json()
        const runId = mapsData.data?.id

        if (runId) {
          // Buscar resultados
          const resultsResponse = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}/dataset/items`,
            { headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` } }
          )
          
          const places = await resultsResponse.json()
          console.log(`📍 Encontradas ${places.length} corretoras`)

          // Extrair Instagram das corretoras
          for (const place of places) {
            // Procurar Instagram no website ou social links
            const website = place.website || ''
            const socialUrls = place.socialUrls || []
            
            const instagramUrl = socialUrls.find((url: string) => url.includes('instagram.com'))
            if (instagramUrl) {
              const match = instagramUrl.match(/instagram\.com\/([^\/\?]+)/)
              if (match) {
                instagramUsernames.push(match[1])
              }
            }
          }
        }
      }

      console.log(`📸 Instagram das corretoras: ${instagramUsernames.length}`)
    }

    if (instagramUsernames.length === 0) {
      // Se não encontrou nenhum Instagram, usar alguns defaults para teste
      console.log('⚠️ Nenhum Instagram encontrado, usando perfis de exemplo')
      return new Response(JSON.stringify({
        success: true,
        count: 0,
        message: 'Nenhuma imobiliária com Instagram encontrada na região. Tente modo manual.'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Buscar seguidores dos perfis encontrados
    const allFollowers: any[] = []

    for (const username of instagramUsernames.slice(0, 5)) { // Limitar a 5 perfis
      console.log(`🔍 Buscando seguidores de @${username}...`)

      try {
        // Usar Apify Instagram Profile Scraper para pegar seguidores
        const igResponse = await fetch('https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs?waitForFinish=120', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${APIFY_TOKEN}`
          },
          body: JSON.stringify({
            usernames: [username],
            resultsLimit: maxSeguidores,
            proxy: { useApifyProxy: true }
          })
        })

        if (!igResponse.ok) {
          console.log(`❌ Erro ao buscar @${username}:`, await igResponse.text())
          continue
        }

        const igData = await igResponse.json()
        const runId = igData.data?.id

        if (runId) {
          const followersResponse = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}/dataset/items`,
            { headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` } }
          )
          
          const profileData = await followersResponse.json()
          console.log(`👥 Dados de @${username}:`, profileData.length)

          // Para cada perfil/seguidor encontrado
          for (const profile of profileData) {
            // Extrair cidade da bio
            const bio = profile.biography || ''
            let cidadeDetectada = ''
            let estadoDetectado = ''

            // Padrões comuns de localização na bio
            const locationPatterns = [
              /📍\s*([^,\n]+),?\s*([A-Z]{2})?/i,
              /Rio de Janeiro|São Paulo|Barra da Tijuca|Copacabana|Ipanema|Leblon/i
            ]

            for (const pattern of locationPatterns) {
              const match = bio.match(pattern)
              if (match) {
                cidadeDetectada = match[1] || match[0]
                estadoDetectado = match[2] || 'RJ'
                break
              }
            }

            allFollowers.push({
              instagram_username: profile.username,
              instagram_url: `https://instagram.com/${profile.username}`,
              nome_completo: profile.fullName,
              foto_url: profile.profilePicUrl,
              bio: bio,
              seguidores: profile.followersCount || 0,
              cidade_detectada: cidadeDetectada,
              estado_detectado: estadoDetectado,
              seguindo_imobiliaria: username,
              imobiliaria_url: `https://instagram.com/${username}`,
              score_total: profile.followersCount > 1000 ? 60 : 40,
              qualificacao: profile.followersCount > 5000 ? 'QUENTE' : 'MORNO'
            })
          }
        }
      } catch (err) {
        console.error(`Erro ao processar @${username}:`, err)
      }
    }

    console.log(`✅ Total de seguidores encontrados: ${allFollowers.length}`)

    // Salvar no banco de dados
    for (const follower of allFollowers) {
      const { error } = await supabase
        .from('seguidores_concorrentes')
        .upsert({
          user_id: userId,
          instagram_username: follower.instagram_username,
          instagram_url: follower.instagram_url,
          nome_completo: follower.nome_completo,
          foto_url: follower.foto_url,
          bio: follower.bio,
          seguidores: follower.seguidores,
          cidade_detectada: follower.cidade_detectada,
          estado_detectado: follower.estado_detectado,
          seguindo_imobiliaria: follower.seguindo_imobiliaria,
          imobiliaria_url: follower.imobiliaria_url,
          score_total: follower.score_total,
          qualificacao: follower.qualificacao
        }, { 
          onConflict: 'instagram_username',
          ignoreDuplicates: true 
        })

      if (error) {
        console.log('Erro ao salvar seguidor:', error.message)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      count: allFollowers.length,
      imobiliarias_encontradas: instagramUsernames.length,
      seguidores: allFollowers.slice(0, 10) // Retorna amostra
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('❌ Erro:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
