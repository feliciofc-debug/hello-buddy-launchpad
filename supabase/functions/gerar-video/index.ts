import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DURATION_COSTS: Record<number, number> = { 6: 1, 12: 2, 30: 5 }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { prompt, productUrl, image, duration = 6, predictionId } = body

    // Modo 1: consulta de status (evita manter conexão aberta por minutos)
    if (predictionId) {
      const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_KEY')
      if (!REPLICATE_API_TOKEN) {
        return new Response(
          JSON.stringify({ success: false, error: 'REPLICATE_API_KEY não configurada.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const statusResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        { headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` } }
      )
      const status = await statusResponse.json()

      if (!statusResponse.ok) {
        console.error('❌ Replicate status error:', status)
        return new Response(
          JSON.stringify({ success: false, error: status.detail || status.error || 'Erro ao consultar status' }),
          { status: statusResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (status.status === 'succeeded') {
        const videoUrl = Array.isArray(status.output) ? status.output[0] : status.output
        return new Response(
          JSON.stringify({ success: true, status: 'succeeded', videoUrl }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (status.status === 'failed') {
        return new Response(
          JSON.stringify({ success: false, status: 'failed', error: status.error || 'Falha ao gerar vídeo' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, status: status.status || 'processing' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🎬 Gerando vídeo com:', { prompt, productUrl, duration, hasImage: !!image })

    if (!prompt && !image) {
      return new Response(
        JSON.stringify({ success: false, error: 'Prompt ou imagem são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const validDuration = [6, 12, 30].includes(duration) ? duration : 6
    const creditsNeeded = DURATION_COSTS[validDuration]

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não encontrado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Usuário autenticado:', user.id)

    let { data: creditsData } = await supabase
      .from('user_video_credits')
      .select('credits_remaining')
      .eq('user_id', user.id)
      .single()

    if (!creditsData) {
      const { data: newCredits } = await supabase
        .from('user_video_credits')
        .insert({ user_id: user.id, credits_remaining: 10 })
        .select('credits_remaining')
        .single()
      creditsData = newCredits
    }

    const currentCredits = creditsData?.credits_remaining ?? 0

    if (currentCredits < creditsNeeded) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Créditos insuficientes! Você tem ${currentCredits}, precisa de ${creditsNeeded}.`,
          creditsRemaining: currentCredits,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cobrar créditos na largada (evita exploração e mantém saldo consistente)
    const newCredits = currentCredits - creditsNeeded
    await supabase
      .from('user_video_credits')
      .update({ credits_remaining: newCredits, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)

    console.log('💳 Créditos cobrados:', creditsNeeded, 'restante:', newCredits)

    const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_KEY')

    if (!REPLICATE_API_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: 'REPLICATE_API_KEY não configurada.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PROMPT ENGINEERING AVANÇADO - Garantir ação específica e realismo extremo
    let finalPrompt = prompt
    if (prompt) {
      // Detectar se é sobre pássaros para prompt super específico
      const birdKeywords = ['bird', 'passarinho', 'pássaro', 'ave', 'pájaro', 'colorful bird']
      const isBird = birdKeywords.some(kw => prompt.toLowerCase().includes(kw))
      
      // Detectar se menciona ação de voar
      const flyingKeywords = ['voando', 'flying', 'voa', 'fly', 'galho', 'branch', 'árvore', 'tree']
      const hasFlyingAction = flyingKeywords.some(kw => prompt.toLowerCase().includes(kw))
      
      if (isBird && hasFlyingAction) {
        // PROMPT ULTRA-ESPECÍFICO PARA PÁSSARO VOANDO
        finalPrompt = `Hyper-realistic slow-motion wildlife documentary footage of a beautiful exotic colorful tropical bird in flight, actively flying from branch to branch in a lush tropical rainforest. The bird is mid-air with wings fully spread, showing dynamic flight movement. Shot in 8K with RED EPIC camera, 120fps slow-motion, telephoto lens 600mm, capturing every feather detail. BBC Earth Planet Earth II quality. Natural golden hour sunlight filtering through jungle canopy. The bird lands gracefully on a tree branch. Real wildlife behavior, anatomically perfect bird with realistic flight physics, not walking, not standing still, actively flying through the forest.`
      } else if (isBird) {
        // Pássaro genérico mas realista
        finalPrompt = `Ultra-realistic BBC Earth documentary footage of a ${prompt}. Shot on RED camera 8K, wildlife telephoto lens, slow-motion 120fps, National Geographic photography. Real bird behavior, anatomically correct, natural movement, forest habitat, golden hour cinematic lighting, shallow depth of field, film grain texture.`
      } else {
        // Detectar outros animais/natureza
        const animalKeywords = ['animal', 'cat', 'dog', 'gato', 'cachorro', 'fish', 'peixe', 'butterfly', 'borboleta', 'insect', 'inseto', 'wildlife', 'nature', 'floresta', 'forest', 'jungle', 'selva']
        const isWildlife = animalKeywords.some(kw => prompt.toLowerCase().includes(kw))
        
        if (isWildlife) {
          // Prompt especializado para vida selvagem
          finalPrompt = `Hyper-realistic BBC Earth documentary footage, shot on RED EPIC 8K camera, 120fps slow-motion. ${prompt}. National Geographic photography quality, telephoto lens detail, real animal behavior with natural movement, anatomically correct, authentic habitat environment, golden hour natural lighting, shallow depth of field, cinematic film grain. No CGI, no animation, pure documentary realism.`
        } else {
          // Prompt genérico ultra-realista
          finalPrompt = `Cinematic 8K footage shot on ARRI Alexa LF camera, anamorphic lens, natural lighting, professional Hollywood cinematography. ${prompt}. Photorealistic quality, no CGI, real-world footage aesthetic, documentary style.`
        }
      }
    }

    console.log('🚀 Chamando MiniMax video-01 (Hailuo)...')

    const videoInput: any = {
      prompt: finalPrompt,
    }

    if (image) {
      videoInput.first_frame_image = image
    }

    const response = await fetch('https://api.replicate.com/v1/models/minimax/video-01/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: videoInput }),
    })

    const prediction = await response.json()

    if (!response.ok) {
      console.error('❌ Replicate error:', prediction)

      if (response.status === 402 || prediction.status === 402) {
        return new Response(
          JSON.stringify({
            success: false,
            error: '⚠️ Créditos Replicate esgotados! Acesse replicate.com/account/billing.',
            creditsRemaining: currentCredits,
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: prediction.detail || prediction.error || 'Erro ao iniciar geração',
          creditsRemaining: currentCredits,
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('⏳ Prediction criada:', prediction.id)

    // OBS: não fazemos polling aqui para não estourar timeout/conexão; o frontend consulta status.
    return new Response(
      JSON.stringify({
        success: true,
        status: 'processing',
        predictionId: prediction.id,
        creditsRemaining: newCredits,
        duration: validDuration,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Erro geral:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
