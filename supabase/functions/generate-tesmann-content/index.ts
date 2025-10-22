import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// O "Prompt Mestre" que ensina a IA a pensar como o Thiago Tesmann
const getTesmannPrompt = (productName: string, productPrice: string, productDescription: string) => {
  return `
Você é um especialista em marketing digital e tráfego pago, modelado nos ensinamentos de Thiago Tesmann. Sua missão é criar uma estratégia de marketing completa para o produto fornecido, focando em conversão direta e criação de desejo. Seja direto, persuasivo e use gatilhos mentais.

Produto:
- Nome: ${productName}
- Preço: ${productPrice}
- Descrição: ${productDescription}

Gere o conteúdo em 4 formatos distintos, separados por '---'. Use emojis para tornar a comunicação mais visual e atraente.

Formato 1: SCRIPT_REELS
Crie um roteiro de 15-20 segundos para um Reels/TikTok. Estrutura: Gancho (3s) -> Problema/Desejo (7s) -> Solução/CTA (5s).

---
Formato 2: POST_INSTAGRAM
Crie uma legenda para um post no feed do Instagram. Inclua uma headline forte, texto persuasivo com gatilhos (escassez, prova social) e 5 hashtags relevantes.

---
Formato 3: MENSAGEM_WHATSAPP
Crie uma mensagem curta e poderosa para ser enviada em um grupo de ofertas no WhatsApp. Foco total na oferta e urgência.

---
Formato 4: IDEIAS_ANUNCIO_FACEBOOK
Liste 3 públicos de interesse para uma campanha de Facebook Ads e sugira uma headline (título) para o anúncio.
  `
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { product } = await req.json()

    if (!product) {
      throw new Error('Dados do produto não fornecidos.')
    }

    const prompt = getTesmannPrompt(
      product.title || product.productName,
      `R$ ${product.price || product.salePrice}`,
      product.description || product.title || product.productName
    )

    console.log('🤖 [TESMANN] Gerando conteúdo para produto:', product.title)

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada')
    }

    // Chamada à Lovable AI usando o endpoint correto
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [TESMANN] Erro na API:', response.status, errorText)
      throw new Error(`Erro na Lovable AI: ${response.status} - ${errorText}`)
    }

    const aiResponse = await response.json()
    const content = aiResponse.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('Nenhum conteúdo gerado pela IA')
    }

    console.log('✅ [TESMANN] Conteúdo gerado com sucesso')

    // Processa a resposta para separar os 4 formatos
    const parts = content.split('---').map((part: string) => part.trim())
    const structuredContent = {
      reelsScript: parts[0]?.replace('SCRIPT_REELS', '').replace('Formato 1:', '').trim() || parts[0]?.trim(),
      instagramPost: parts[1]?.replace('POST_INSTAGRAM', '').replace('Formato 2:', '').trim() || parts[1]?.trim(),
      whatsappMessage: parts[2]?.replace('MENSAGEM_WHATSAPP', '').replace('Formato 3:', '').trim() || parts[2]?.trim(),
      facebookAdIdeas: parts[3]?.replace('IDEIAS_ANUNCIO_FACEBOOK', '').replace('Formato 4:', '').trim() || parts[3]?.trim(),
    }

    return new Response(JSON.stringify({ content: structuredContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('💥 [TESMANN] Erro:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
