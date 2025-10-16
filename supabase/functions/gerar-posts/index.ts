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
    const { produto } = await req.json();
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    console.log(`Gerando posts para produto: ${produto.nome}`);

    const prompt = `Crie 3 posts promocionais para o seguinte produto da Amazon:

Produto: ${produto.nome}
Preço: R$ ${produto.preco}
Avaliação: ${produto.rating} estrelas (${produto.reviews} reviews)
Comissão: R$ ${produto.comissao}

Gere 3 posts no seguinte formato JSON:
1. Um post para Instagram (curto, com emojis, chamativo)
2. Um post para WhatsApp (direto, com link de compra)
3. Um script de vendedor (persuasivo, destaca benefícios)

Retorne APENAS um JSON válido no formato:
{
  "posts": [
    {"tipo": "Instagram", "conteudo": "texto aqui"},
    {"tipo": "WhatsApp", "conteudo": "texto aqui"},
    {"tipo": "Vendedor", "conteudo": "texto aqui"}
  ]
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 1000,
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na API Gemini:', response.status, errorText);
      throw new Error(`Erro na API Gemini: ${response.status}`);
    }

    const data = await response.json();
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('Resposta do Gemini:', texto);

    // Extrair JSON da resposta
    const jsonMatch = texto.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Resposta da IA não contém JSON válido');
    }

    const resultado = JSON.parse(jsonMatch[0]);
    
    const posts = resultado.posts.map((post: any, index: number) => ({
      id: `post_${Date.now()}_${index}`,
      tipo: post.tipo,
      conteudo: post.conteudo,
      produtoId: produto.id
    }));

    console.log(`Posts gerados com sucesso: ${posts.length}`);

    return new Response(
      JSON.stringify({ posts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao gerar posts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
