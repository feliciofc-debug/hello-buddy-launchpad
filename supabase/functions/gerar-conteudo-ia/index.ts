import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productTitle, productPrice, productRating, productLink, platform } = await req.json();
    
    console.log('Gerando conteúdo com Lovable AI para:', { productTitle, platform });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    // Criar prompt específico para cada plataforma
    let prompt = '';

    if (platform === 'instagram') {
      prompt = `Crie uma legenda de Instagram para promover este produto:
Produto: ${productTitle}
Preço: R$ ${productPrice}
Avaliação: ${productRating}/5 estrelas

A legenda deve:
- Ser atrativa e usar emojis relevantes
- Ter no máximo 2200 caracteres
- Incluir call-to-action
- Sugerir 5-8 hashtags relevantes
- Mencionar "link na bio"`;
    } else if (platform === 'whatsapp') {
      prompt = `Crie uma mensagem de WhatsApp para promover este produto:
Produto: ${productTitle}
Preço: R$ ${productPrice}
Avaliação: ${productRating}/5 estrelas

A mensagem deve:
- Ser curta e direta
- Usar emojis estrategicamente
- Criar urgência
- Incluir o link: ${productLink}`;
    } else if (platform === 'facebook') {
      prompt = `Crie um post de Facebook para promover este produto:
Produto: ${productTitle}
Preço: R$ ${productPrice}
Avaliação: ${productRating}/5 estrelas

O post deve:
- Ser informativo e persuasivo
- Destacar benefícios
- Incluir call-to-action claro
- Link: ${productLink}`;
    } else if (platform === 'tiktok') {
      prompt = `Crie um script de TikTok para promover este produto:
Produto: ${productTitle}
Preço: R$ ${productPrice}
Avaliação: ${productRating}/5 estrelas

O script deve:
- Ter gancho forte nos primeiros 3 segundos
- Ser dinâmico e energético
- Mencionar "link nos comentários"
- Usar linguagem jovem`;
    } else {
      prompt = `Crie um email marketing para promover este produto:
Produto: ${productTitle}
Preço: R$ ${productPrice}
Avaliação: ${productRating}/5 estrelas

O email deve incluir:
- Assunto irresistível
- Corpo do email bem estruturado
- Benefícios claros
- Call-to-action forte
- Link: ${productLink}`;
    }

    // Chamar Lovable AI Gateway
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
            role: 'system',
            content: 'Você é um especialista em marketing digital e copywriting. Crie conteúdos atrativos e persuasivos.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.9,
        max_tokens: 2048
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na Lovable AI:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Limite de requisições excedido. Tente novamente em alguns instantes.');
      }
      if (response.status === 402) {
        throw new Error('Créditos insuficientes. Por favor, adicione créditos ao workspace.');
      }
      
      throw new Error(`Erro ao gerar conteúdo: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;

    console.log('Conteúdo gerado com sucesso via Lovable AI');

    return new Response(
      JSON.stringify({ 
        content: generatedContent,
        platform: platform
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Erro em gerar-conteudo-ia:', error);
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Erro ao gerar conteúdo'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});