import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Custo em créditos por duração
const DURATION_COSTS: Record<number, number> = {
  6: 1,
  12: 2,
  30: 5
}

// Frames por duração
const DURATION_FRAMES: Record<number, number> = {
  6: 25,
  12: 50,
  30: 125
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, productUrl, image, duration = 6 } = await req.json()

    console.log('🎬 Gerando vídeo com:', { prompt, productUrl, duration, hasImage: !!image })

    // Validar entrada
    if (!prompt && !image) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Prompt ou imagem são obrigatórios' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validar duração
    const validDuration = [6, 12, 30].includes(duration) ? duration : 6
    const creditsNeeded = DURATION_COSTS[validDuration]
    const numFrames = DURATION_FRAMES[validDuration]

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Não autenticado' 
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Usuário não encontrado' 
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ Usuário autenticado:', user.id)

    // Buscar/criar créditos do usuário
    let { data: creditsData } = await supabase
      .from('user_video_credits')
      .select('credits_remaining')
      .eq('user_id', user.id)
      .single()

    // Se não existir, criar com 10 créditos
    if (!creditsData) {
      const { data: newCredits } = await supabase
        .from('user_video_credits')
        .insert({ user_id: user.id, credits_remaining: 10 })
        .select('credits_remaining')
        .single()
      
      creditsData = newCredits
    }

    const currentCredits = creditsData?.credits_remaining ?? 0

    // Verificar créditos
    if (currentCredits < creditsNeeded) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Créditos insuficientes! Você tem ${currentCredits} créditos, precisa de ${creditsNeeded}.`,
          creditsRemaining: currentCredits
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ Créditos OK:', currentCredits, 'necessário:', creditsNeeded)

    // Configurar Replicate
    const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_KEY')

    if (!REPLICATE_API_TOKEN) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'REPLICATE_API_KEY não configurada. Adicione nas configurações.' 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Preparar prompt final
    let finalPrompt = prompt
    if (productUrl) {
      finalPrompt = `Crie um vídeo promocional atraente para: ${prompt}`
    }

    // Preparar input para Replicate
    const videoInput = image ? {
      input_image: image,
      video_length: "14_frames_with_svd",
      sizing_strategy: "maintain_aspect_ratio",
      frames_per_second: 6,
      motion_bucket_id: 127,
      cond_aug: 0.02,
    } : {
      prompt: finalPrompt,
      num_frames: numFrames,
      num_inference_steps: 25,
    }

    console.log('🚀 Chamando Replicate API...', { numFrames, duration: validDuration })

    // Chamar Replicate API
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: image 
          ? '3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438'
          : 'anotherjesse/zeroscope-v2-xl:9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351',
        input: videoInput
      })
    })

    const prediction = await response.json()

    if (!response.ok) {
      console.error('❌ Replicate error:', prediction)
      
      // Tratar erro 402 (sem créditos Replicate)
      if (response.status === 402 || prediction.status === 402) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: '⚠️ Créditos Replicate esgotados! Acesse replicate.com/account/billing para adicionar créditos.',
            creditsRemaining: currentCredits
          }),
          { 
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: prediction.detail || 'Erro ao iniciar geração de vídeo',
          creditsRemaining: currentCredits
        }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('⏳ Prediction criada:', prediction.id)

    // Polling para aguardar resultado
    let videoUrl = null
    let attempts = 0
    const maxAttempts = 90 // Aumentado para vídeos mais longos

    while (!videoUrl && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const statusResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        { headers: { 'Authorization': `Token ${REPLICATE_API_TOKEN}` }}
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
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      attempts++
    }

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Timeout ao gerar vídeo (mais de 3 minutos)',
          creditsRemaining: currentCredits
        }),
        { 
          status: 504,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Decrementar créditos APÓS sucesso
    const newCredits = currentCredits - creditsNeeded
    await supabase
      .from('user_video_credits')
      .update({ credits_remaining: newCredits, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)

    console.log('💳 Créditos atualizados:', newCredits)

    // Gerar legendas
    const legendas = {
      instagram: `🎥✨ ${finalPrompt}\n\n💫 Aproveite essa oferta incrível!\n🔥 Link na bio!\n\n#reels #instagram #ofertas`,
      facebook: `🎬 ${finalPrompt}\n\n👉 Clique no link para saber mais!\n\n#video #facebook #promocao`,
      tiktok: `🔥 ${finalPrompt}\n\n💥 Não perca!\n\n#tiktok #viral #ofertas #fyp`,
      whatsapp: `🎥 *${finalPrompt}*\n\n✅ Confira agora!\n\n👉 ${productUrl || 'Link aqui'}`
    }

    console.log('✅ Sucesso! Retornando vídeo e legendas')

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl,
        legendas,
        creditsRemaining: newCredits
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    console.error('❌ Erro geral:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro desconhecido ao gerar vídeo'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})