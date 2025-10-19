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
    
    console.log('Gerando conteúdo com Gemini para:', { productTitle, platform });

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY não configurada');
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

    // Chamar Google Gemini API diretamente
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na API Gemini:', response.status, errorText);
      throw new Error(`Erro ao gerar conteúdo: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.candidates[0].content.parts[0].text;

    console.log('Conteúdo gerado com sucesso via Gemini');

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
