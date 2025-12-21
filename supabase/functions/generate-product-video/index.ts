import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { productName, productImage, style, template, productPrice } = await req.json()

    if (!productName || !productImage) {
      throw new Error('productName e productImage são obrigatórios')
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada')
    }

    console.log(`Gerando imagens para: ${productName}, estilo: ${style}, template: ${template}`)

    // Definir prompts baseados no template
    const templatePrompts: Record<string, string[]> = {
      'tiktok': [
        `Product photo of ${productName} on vibrant neon background, trending TikTok aesthetic, dynamic angle, bold colors`,
        `${productName} floating with sparkles and particles, viral TikTok style, eye-catching, Gen-Z aesthetic`,
        `Close-up shot of ${productName} with motion blur effect, trendy social media style`,
        `${productName} with emoji reactions floating around, TikTok viral content style`
      ],
      'reels': [
        `Cinematic product shot of ${productName}, Instagram Reels style, moody lighting, professional`,
        `${productName} lifestyle photo, aesthetic flat lay, Instagram worthy, natural lighting`,
        `Minimalist product photography of ${productName}, clean background, influencer style`,
        `${productName} with gradient background, modern Instagram aesthetic`
      ],
      'stories': [
        `${productName} quick flash sale style, urgent, bold text overlay space, Stories format`,
        `Before/after style layout for ${productName}, transformation aesthetic`,
        `${productName} unboxing moment capture, excitement, Stories aesthetic`,
        `Countdown timer style composition for ${productName}, limited offer vibe`
      ],
      'ecommerce': [
        `${productName} 360 view front angle, white background, e-commerce professional`,
        `${productName} 360 view side angle, studio lighting, marketplace ready`,
        `${productName} 360 view detail shot, showing features, clean product photo`,
        `${productName} in use context, lifestyle e-commerce photography`
      ],
      'flash-sale': [
        `${productName} with explosive sale graphics, red and yellow, urgency`,
        `Flash sale composition with ${productName}, countdown style, bold discount`,
        `${productName} breaking through paper effect, sale reveal style`,
        `Limited time offer layout with ${productName}, attention grabbing`
      ],
      'storytelling': [
        `Problem scenario before using ${productName}, frustrated person silhouette`,
        `${productName} as the solution, hero product shot, spotlight`,
        `Happy result after using ${productName}, satisfied customer vibe`,
        `${productName} transformation journey, before and after split`
      ],
      'promocional': [
        `${productName} with price tag highlight, promotional banner style`,
        `Best seller badge on ${productName}, promotional photography`,
        `${productName} bundle deal composition, value proposition visual`,
        `${productName} with discount percentage overlay space, promo ready`
      ]
    }

    // Definir efeitos baseados no estilo
    const styleEffects: Record<string, string> = {
      'zoom': 'with dramatic zoom perspective, depth of field',
      'transitions': 'with smooth gradient transitions, flowing composition',
      'animated-text': 'with space for animated text overlays, clean areas',
      'glitch': 'with subtle glitch art effects, cyberpunk aesthetic',
      'particles': 'with floating particles, dust motes, magical atmosphere'
    }

    const selectedTemplate = template || 'tiktok'
    const selectedStyle = style || 'zoom'
    const prompts = templatePrompts[selectedTemplate] || templatePrompts['tiktok']
    const styleEffect = styleEffects[selectedStyle] || styleEffects['zoom']

    // Gerar 4 imagens variadas
    const generatedImages: string[] = []
    
    for (let i = 0; i < 4; i++) {
      const prompt = `${prompts[i]} ${styleEffect}. Product: ${productName}. Vertical format 9:16 ratio for social media. High quality, professional photography.`
      
      console.log(`Gerando imagem ${i + 1}/4: ${prompt.substring(0, 100)}...`)

      try {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image-preview',
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],
            modalities: ['image', 'text']
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Erro na geração ${i + 1}:`, errorText)
          
          // Se falhar, usar a imagem original do produto
          generatedImages.push(productImage)
          continue
        }

        const data = await response.json()
        
        // Extrair imagem do response
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url
        
        if (imageUrl) {
          generatedImages.push(imageUrl)
          console.log(`Imagem ${i + 1} gerada com sucesso`)
        } else {
          console.log(`Imagem ${i + 1} sem URL, usando original`)
          generatedImages.push(productImage)
        }
      } catch (imgError) {
        console.error(`Erro ao gerar imagem ${i + 1}:`, imgError)
        generatedImages.push(productImage)
      }

      // Pequeno delay entre requisições para evitar rate limit
      if (i < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // Gerar texto para overlay
    const textOverlays = [
      productName.toUpperCase(),
      productPrice ? `R$ ${productPrice}` : '🔥 OFERTA',
      '👆 LINK NA BIO',
      '⚡ APROVEITE!'
    ]

    return new Response(
      JSON.stringify({
        success: true,
        images: generatedImages,
        textOverlays,
        template: selectedTemplate,
        style: selectedStyle,
        videoDuration: 15, // segundos
        transitionDuration: 0.5 // segundos entre frames
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Erro:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
