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
    const { produto, sugestao } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    console.log(`Gerando posts WhatsApp para produto: ${produto.nome}`);
    console.log(`Sugestão do usuário: ${sugestao || 'Nenhuma'}`);

    // Monta contexto extra se houver sugestão
    const contextoExtra = sugestao 
      ? `\n\nCONTEXTO ADICIONAL DO VENDEDOR:\n"${sugestao}"\n(Use essas informações para personalizar as mensagens - mencione o local, promoção, detalhes específicos etc.)`
      : '';

    // Monta informações de estoque
    const estoqueInfo = produto.estoque !== undefined && produto.estoque !== null
      ? `- Estoque: ${produto.estoque} unidades disponíveis`
      : '';

    // Monta especificações
    const especsInfo = produto.especificacoes 
      ? `- Especificações: ${produto.especificacoes}`
      : '';

    // Monta categoria
    const categoriaInfo = produto.categoria 
      ? `- Categoria: ${produto.categoria}`
      : '';

    const prompt = `Crie 3 mensagens de WhatsApp para vender o seguinte produto:

PRODUTO:
- Nome: ${produto.nome}
- Preço: R$ ${produto.preco || 'A consultar'}
- Descrição: ${produto.descricao || 'Produto de alta qualidade'}
${estoqueInfo}
${especsInfo}
${categoriaInfo}${contextoExtra}

REGRAS IMPORTANTES:
- Mensagens curtas e diretas (máximo 4 linhas)
- Use linguagem informal brasileira natural ("vc", "pra", "blz")
- Inclua 1-2 emojis relevantes (não exagere)
- Comece com saudação amigável
- Inclua {{nome}} para personalização
- Mencione o preço de forma atrativa
- Termine com call-to-action
- SE houver contexto adicional, USE-O para tornar a mensagem mais específica e personalizada

Crie 3 variações diferentes:
1. URGÊNCIA: Foco em escassez/oportunidade única
2. BENEFÍCIO: Foco nas vantagens do produto
3. PROMOCIONAL: Foco em desconto/oferta especial

Retorne APENAS um JSON válido:
{
  "urgencia": "mensagem aqui com {{nome}}",
  "beneficio": "mensagem aqui com {{nome}}",
  "promocional": "mensagem aqui com {{nome}}"
}`;

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
            content: 'Você é um especialista em copywriting para WhatsApp. Crie mensagens de vendas naturais e persuasivas. Retorne APENAS JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.9,
        max_tokens: 800
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
      
      throw new Error(`Erro na API: ${response.status}`);
    }

    const data = await response.json();
    let texto = data.choices[0].message.content;
    
    console.log('Resposta da IA:', texto);

    // Limpar markdown
    texto = texto.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    // Extrair JSON
    const jsonMatch = texto.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Resposta da IA não contém JSON válido');
    }

    // Limpar JSON
    let jsonStr = jsonMatch[0]
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .trim();

    const resultado = JSON.parse(jsonStr);
    
    console.log('Posts WhatsApp gerados com sucesso');

    return new Response(
      JSON.stringify({ posts: resultado }),
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
