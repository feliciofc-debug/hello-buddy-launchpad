import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, productUrl, image } = await req.json()

    console.log('🎬 Gerando vídeo com:', { prompt, productUrl })

    // Configurar Replicate
    const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_KEY')

    if (!REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_KEY não configurada')
    }

    // Se tiver URL do produto, buscar dados primeiro
    let productData = null
    let finalPrompt = prompt

    if (productUrl) {
      // Aqui você pode fazer scraping ou usar a mesma lógica da analisar-produto
      // Por enquanto vamos usar o prompt direto
      finalPrompt = `Crie um vídeo promocional atraente para: ${prompt}`
    }

    // Preparar imagem base64 ou usar prompt texto
    let videoInput: any = {
      prompt: finalPrompt,
      num_frames: 25,
      num_inference_steps: 25,
    }

    // Se tiver imagem, usar Stable Video Diffusion
    if (image) {
      videoInput = {
        input_image: image,
        video_length: "14_frames_with_svd",
        sizing_strategy: "maintain_aspect_ratio",
        frames_per_second: 6,
        motion_bucket_id: 127,
        cond_aug: 0.02,
      }
    }

    // Chamar Replicate API
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: image 
          ? '3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438' // Stable Video Diffusion
          : 'anotherjesse/zeroscope-v2-xl:9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351', // Zeroscope (texto)
        input: videoInput
      })
    })

    const prediction = await response.json()

    if (!response.ok) {
      console.error('Replicate error:', prediction)
      throw new Error(prediction.detail || 'Erro ao gerar vídeo')
    }

    console.log('Prediction criada:', prediction.id)

    // Aguardar processamento (polling)
    let videoUrl = null
    let attempts = 0
    const maxAttempts = 60 // 60 segundos max

    while (!videoUrl && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // Aguarda 2s
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        }
      })

      const status = await statusResponse.json()
      
      console.log('Status:', status.status)

      if (status.status === 'succeeded') {
        videoUrl = status.output
        break
      }

      if (status.status === 'failed') {
        console.error('Replicate failed:', status.error)
        throw new Error('Falha ao gerar vídeo')
      }

      attempts++
    }

    if (!videoUrl) {
      throw new Error('Timeout ao gerar vídeo')
    }

    // Gerar legendas para cada rede social
    const legendas = {
      instagram: `🎥✨ ${finalPrompt}\n\n💫 Aproveite essa oferta incrível!\n🔥 Link na bio!\n\n#reels #instagram #ofertas`,
      facebook: `🎬 ${finalPrompt}\n\n👉 Clique no link para saber mais!\n\n#video #facebook #promocao`,
      tiktok: `🔥 ${finalPrompt}\n\n💥 Não perca!\n\n#tiktok #viral #ofertas #fyp`,
      whatsapp: `🎥 *${finalPrompt}*\n\n✅ Confira agora!\n\n👉 ${productUrl || 'Link aqui'}`
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl,
        legendas,
        produto: productData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error: any) {
    console.error('❌ Erro:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
