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
    const { url } = await req.json();
    console.log('📝 Gerando posts genéricos para:', url);

    if (!url) {
      throw new Error('URL não fornecida');
    }

    // GERAR POSTS GENÉRICOS COM IA - SEM SCRAPING
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const promptInsta = `Crie um post vendedor para Instagram sobre um produto em promoção.
Use linguagem urgente, emojis relevantes e call-to-action forte.
Deixe placeholders [NOME DO PRODUTO] e [PREÇO] para o usuário preencher.
Máximo 150 caracteres.
Exemplo: "🔥 OFERTA RELÂMPAGO! [NOME DO PRODUTO] por apenas [PREÇO]! Poucas unidades! 😱 Compre agora!"`;

    const promptStory = `Crie um texto curto e impactante para story do Instagram sobre produto em oferta.
Use senso de urgência e escassez.
Deixe placeholders [NOME DO PRODUTO] e [PREÇO].
Máximo 80 caracteres.
Exemplo: "🚨 SÓ HOJE! [NOME DO PRODUTO] - [PREÇO]! Corre! ⏰"`;

    const promptWhats = `Crie uma mensagem amigável para WhatsApp recomendando um produto.
Tom informal como se fosse um amigo indicando.
Deixe placeholders [NOME DO PRODUTO] e [PREÇO].
Máximo 200 caracteres.
Exemplo: "Opa! 👋 Achei essa oferta INCRÍVEL! [NOME DO PRODUTO] por só [PREÇO]! Tá muito barato, vale a pena!"`;

    const generateText = async (prompt: string) => {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'Você é um especialista em copywriting para afiliados. Crie textos persuasivos com placeholders para o usuário personalizar.' },
            { role: 'user', content: prompt }
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Limite de requisições excedido. Tente novamente em alguns instantes.');
        }
        if (response.status === 402) {
          throw new Error('Créditos esgotados. Adicione créditos ao workspace.');
        }
        const errorText = await response.text();
        console.error('Erro na API Lovable AI:', response.status, errorText);
        throw new Error('Erro ao gerar conteúdo com IA');
      }

      const data = await response.json();
      return data.choices[0].message.content;
    };

    const [textoInsta, textoStory, textoWhats] = await Promise.all([
      generateText(promptInsta),
      generateText(promptStory),
      generateText(promptWhats)
    ]);

    console.log('✅ Posts genéricos gerados com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        produto: {
          titulo: '[NOME DO PRODUTO]',
          preco: '[PREÇO]',
          url
        },
        posts: {
          instagram: textoInsta,
          story: textoStory,
          whatsapp: textoWhats
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Erro na função analisar-produto:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
