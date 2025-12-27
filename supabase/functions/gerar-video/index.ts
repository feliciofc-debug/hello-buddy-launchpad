import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, productUrl, image } = await req.json()

    console.log('🎬 Gerando vídeo com:', { prompt, productUrl, hasImage: !!image })

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
      num_frames: 25,
      num_inference_steps: 25,
    }

    console.log('🚀 Chamando Replicate API...')

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
      
      // Tratar erro 402 (sem créditos) especificamente
      if (response.status === 402 || prediction.status === 402) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: '⚠️ Créditos Replicate esgotados! Acesse replicate.com/account/billing para adicionar créditos.' 
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
          error: prediction.detail || 'Erro ao iniciar geração de vídeo' 
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
    const maxAttempts = 60

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
            error: 'Falha ao gerar vídeo: ' + (status.error || 'Erro desconhecido')
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
          error: 'Timeout ao gerar vídeo (mais de 2 minutos)' 
        }),
        { 
          status: 504,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

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
        legendas
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
