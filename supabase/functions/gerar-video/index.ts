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
    const { prompt, productUrl, image, duration = 6 } = await req.json()

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
          creditsRemaining: currentCredits
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Créditos OK:', currentCredits, 'necessário:', creditsNeeded)

    const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_KEY')

    if (!REPLICATE_API_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: 'REPLICATE_API_KEY não configurada.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Preparar prompt ultra realista detalhado para MiniMax
    let finalPrompt = prompt
    if (!prompt.toLowerCase().includes('ultra') && !prompt.toLowerCase().includes('realistic') && !prompt.toLowerCase().includes('cinematic')) {
      finalPrompt = `Ultra realistic cinematic 4K footage, hyper-detailed, photorealistic, natural lighting, professional cinematography: ${prompt}`
    }

    console.log('🚀 Chamando MiniMax video-01 (Hailuo)...')

    // Usar o modelo MiniMax video-01 (Hailuo) - muito superior em qualidade!
    // Referência: https://replicate.com/minimax/video-01
    const videoInput: any = {
      prompt: finalPrompt,
    }

    // Se tiver imagem, usar image-to-video
    if (image) {
      videoInput.first_frame_image = image
    }

    const response = await fetch('https://api.replicate.com/v1/models/minimax/video-01/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: videoInput
      })
    })

    const prediction = await response.json()

    if (!response.ok) {
      console.error('❌ Replicate error:', prediction)
      
      if (response.status === 402 || prediction.status === 402) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: '⚠️ Créditos Replicate esgotados! Acesse replicate.com/account/billing.',
            creditsRemaining: currentCredits
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: prediction.detail || prediction.error || 'Erro ao iniciar geração',
          creditsRemaining: currentCredits
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('⏳ Prediction criada:', prediction.id)

    // Polling para aguardar resultado - MiniMax pode demorar 3-5 min
    let videoUrl = null
    let attempts = 0
    const maxAttempts = 150 // 5 minutos (150 * 2s)

    while (!videoUrl && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const statusResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        { headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` }}
      )

      const status = await statusResponse.json()
      console.log(`⏳ Status (tentativa ${attempts + 1}):`, status.status)

      if (status.status === 'succeeded') {
        videoUrl = Array.isArray(status.output) ? status.output[0] : status.output
        console.log('✅ Vídeo gerado:', videoUrl)
        break
      }

      if (status.status === 'failed') {
        console.error('❌ Falha:', status.error)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Falha ao gerar vídeo: ' + (status.error || 'Erro desconhecido'),
            creditsRemaining: currentCredits
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      attempts++
    }

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Timeout ao gerar vídeo (mais de 5 minutos)',
          creditsRemaining: currentCredits
        }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Decrementar créditos APÓS sucesso
    const newCredits = currentCredits - creditsNeeded
    await supabase
      .from('user_video_credits')
      .update({ credits_remaining: newCredits, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)

    console.log('💳 Créditos atualizados:', newCredits)

    const legendas = {
      instagram: `🎥✨ ${prompt}\n\n💫 Aproveite!\n🔥 Link na bio!\n\n#reels #instagram #viral`,
      facebook: `🎬 ${prompt}\n\n👉 Clique no link!\n\n#video #facebook`,
      tiktok: `🔥 ${prompt}\n\n💥 Não perca!\n\n#tiktok #viral #fyp`,
      whatsapp: `🎥 *${prompt}*\n\n✅ Confira!\n\n👉 ${productUrl || 'Link aqui'}`
    }

    console.log('✅ Sucesso!')

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl,
        legendas,
        creditsRemaining: newCredits,
        duration: validDuration
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
