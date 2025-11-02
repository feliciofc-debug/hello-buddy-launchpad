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

    const prompt = `Crie posts promocionais para o seguinte produto:

Produto: ${produto.nome}
Preço: R$ ${produto.preco}
${produto.rating ? `Avaliação: ${produto.rating} estrelas (${produto.reviews} reviews)` : ''}
${produto.comissao ? `Comissão: R$ ${produto.comissao}` : ''}

Gere 9 variações de posts, 3 para cada tipo:

INSTAGRAM (3 variações):
- Opção A: Estilo direto/urgente com call-to-action forte
- Opção B: Estilo storytelling, conte uma história
- Opção C: Estilo educativo, ensine algo relacionado ao produto

FACEBOOK (3 variações):
- Opção A: Casual/amigável, tom de conversa
- Opção B: Profissional/informativo com dados e benefícios
- Opção C: Promocional/vendedor com senso de urgência

STORY INSTAGRAM (3 variações, MAX 80 caracteres cada):
- Opção A: Curto e impactante com emoji
- Opção B: Pergunta interativa para engajamento
- Opção C: Contagem regressiva ou urgência

Retorne APENAS um JSON válido no formato:
{
  "instagram": {
    "opcaoA": "texto aqui",
    "opcaoB": "texto aqui",
    "opcaoC": "texto aqui"
  },
  "facebook": {
    "opcaoA": "texto aqui",
    "opcaoB": "texto aqui",
    "opcaoC": "texto aqui"
  },
  "story": {
    "opcaoA": "texto curto aqui (max 80 chars)",
    "opcaoB": "texto curto aqui (max 80 chars)",
    "opcaoC": "texto curto aqui (max 80 chars)"
  }
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
    
    console.log(`Posts gerados com sucesso para 3 plataformas`);

    return new Response(
      JSON.stringify(resultado),
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
