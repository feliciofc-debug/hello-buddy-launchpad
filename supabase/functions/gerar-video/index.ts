import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DURATION_COSTS: Record<number, number> = { 6: 1, 12: 2, 30: 5 }

// Função para detectar categoria do conteúdo
function detectCategory(prompt: string): string {
  const lower = prompt.toLowerCase()
  
  if (/\b(óculos|relógio|tênis|roupa|sapato|bolsa|mochila|watch|glasses|shoes|bag|produto|product)\b/.test(lower)) {
    return 'produto'
  }
  if (/\b(comida|bebida|pizza|hambúrguer|sushi|café|food|drink|restaurant|alimento)\b/.test(lower)) {
    return 'alimento'
  }
  if (/\b(pássaro|cachorro|gato|animal|natureza|floresta|bird|dog|cat|nature|forest|wildlife)\b/.test(lower)) {
    return 'natureza'
  }
  if (/\b(celular|computador|notebook|fone|gadget|phone|laptop|tech|tecnologia)\b/.test(lower)) {
    return 'tecnologia'
  }
  if (/\b(carro|moto|veículo|car|motorcycle|vehicle|automóvel)\b/.test(lower)) {
    return 'automovel'
  }
  if (/\b(maquiagem|perfume|creme|skincare|makeup|beauty|beleza|cosmético)\b/.test(lower)) {
    return 'beleza'
  }
  if (/\b(casa|apartamento|imóvel|house|apartment|real estate|prédio)\b/.test(lower)) {
    return 'imovel'
  }
  if (/\b(pessoa|modelo|fitness|yoga|people|model|lifestyle|mulher|homem)\b/.test(lower)) {
    return 'pessoas'
  }
  
  return 'generico'
}

// Templates de prompt por categoria
function getCategoryPrompt(category: string, userPrompt: string): string {
  const templates: Record<string, string> = {
    'produto': `Professional product videography showcasing ${userPrompt}. 360-degree rotating view, studio lighting, clean background, 4K commercial quality, smooth camera movement revealing all angles and details. High-end advertising aesthetic.`,
    
    'alimento': `Appetizing food videography of ${userPrompt}. Close-up macro shots, steam rising, fresh ingredients, restaurant-quality presentation, warm cinematic lighting, mouth-watering details. Culinary commercial style.`,
    
    'natureza': `BBC Earth documentary style footage of ${userPrompt}. Wildlife cinematography, natural behavior, realistic movement, golden hour lighting, authentic habitat environment. National Geographic quality.`,
    
    'pessoas': `Lifestyle commercial footage featuring ${userPrompt}. Natural movements, authentic emotions, cinematic color grading, shallow depth of field, relatable and engaging. Professional lifestyle photography.`,
    
    'tecnologia': `Tech product reveal of ${userPrompt}. Sleek modern aesthetics, minimalist background, dynamic camera angles, futuristic lighting, innovation showcase. High-tech commercial style.`,
    
    'automovel': `Automotive commercial videography of ${userPrompt}. Dynamic shots, reflective surfaces, urban or scenic background, cinematic motion, speed and elegance. Premium car advertising quality.`,
    
    'imovel': `Real estate architectural videography of ${userPrompt}. Smooth gimbal movement, interior walkthrough, natural daylight, spacious feel, luxury presentation. Professional property showcase.`,
    
    'beleza': `Beauty product commercial for ${userPrompt}. Elegant presentation, soft diffused lighting, luxurious aesthetics, close-up detail shots, premium feel. High-end cosmetics advertising.`,
    
    'generico': `Cinematic high-quality footage of ${userPrompt}. Professional videography, natural movement, optimal lighting, engaging composition. Premium production value.`
  }
  
  return templates[category] || templates['generico']
}

// Aplicar estilo ao prompt
function applyStyle(basePrompt: string, style: string): string {
  const styleModifiers: Record<string, string> = {
    'comercial': 'Advertising quality, high-end commercial production, brand-focused presentation.',
    'documental': 'Documentary style, authentic and natural, real-world footage aesthetic.',
    'cinematografico': 'Cinematic color grading, film-like quality, artistic composition, movie-grade production.',
    'minimalista': 'Minimalist aesthetic, clean composition, simple elegant design, uncluttered visuals.',
    'lifestyle': 'Lifestyle photography, candid and relatable, everyday authenticity, human connection.'
  }
  
  if (style && style !== 'automatico' && styleModifiers[style]) {
    return `${basePrompt} ${styleModifiers[style]}`
  }
  
  return basePrompt
}

// Aplicar intensidade de movimento
function applyMovement(basePrompt: string, movement: string): string {
  const movementModifiers: Record<string, string> = {
    'suave': 'Slow gentle camera movement, smooth elegant transitions, subtle motion.',
    'moderado': 'Natural camera movement, balanced pacing, professional fluidity.',
    'dinamico': 'Dynamic camera motion, energetic movement, action-packed shots, fast-paced editing.'
  }
  
  return `${basePrompt} ${movementModifiers[movement] || movementModifiers['moderado']}`
}

// Construir prompt final inteligente
function buildIntelligentPrompt(userPrompt: string, style: string = 'automatico', movement: string = 'moderado'): string {
  // Detectar categoria
  const category = detectCategory(userPrompt)
  
  // Pegar template base
  let finalPrompt = getCategoryPrompt(category, userPrompt)
  
  // Aplicar estilo
  finalPrompt = applyStyle(finalPrompt, style)
  
  // Aplicar movimento
  finalPrompt = applyMovement(finalPrompt, movement)
  
  // Adicionar qualidade geral
  finalPrompt += ' Shot in 4K resolution, professional videography, optimal lighting conditions, high production value.'
  
  console.log('📝 Prompt construído:', { category, style, movement, finalPrompt })
  
  return finalPrompt
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { 
      prompt, 
      productUrl, 
      image, 
      duration = 6, 
      predictionId,
      style = 'automatico',
      movement = 'moderado'
    } = body

    // Modo consulta de status
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

    console.log('🎬 Gerando vídeo com:', { prompt, duration, style, movement, hasImage: !!image })

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

    // Cobrar créditos
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

    // 🎯 CONSTRUIR PROMPT INTELIGENTE
    const finalPrompt = buildIntelligentPrompt(prompt, style, movement)

    console.log('🚀 Chamando MiniMax video-01...')

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

    return new Response(
      JSON.stringify({
        success: true,
        status: 'processing',
        predictionId: prediction.id,
        creditsRemaining: newCredits,
        duration: validDuration,
        promptUsed: finalPrompt
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
