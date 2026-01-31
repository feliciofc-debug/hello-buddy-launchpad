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
    const { productName, productImage, editPrompt, mode } = await req.json();

    if (!productImage) {
      throw new Error('Imagem do produto é obrigatória');
    }

    if (!editPrompt) {
      throw new Error('Descrição de como quer a imagem é obrigatória');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    console.log(`Editando imagem para: ${productName}`);
    console.log(`Prompt: ${editPrompt}`);

    // Usar Gemini para editar a imagem - modelo correto
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Edite esta imagem de produto conforme a descrição abaixo.

Produto: ${productName || 'Produto'}
Instruções de edição: ${editPrompt}

INSTRUÇÕES IMPORTANTES:
- NÃO ADICIONE NENHUM TEXTO, PALAVRAS OU LETRAS NA IMAGEM!
- Sem tipografia, sem legendas, sem sobreposição de texto!
- Mantenha o produto original claramente visível e reconhecível
- Apenas melhore o contexto/fundo conforme solicitado
- Mantenha qualidade profissional de fotografia de produto
- Use iluminação que valorize o produto
- Apenas fotografia pura, sem elementos de design gráfico com texto!
- ABSOLUTAMENTE ZERO TEXTO NA IMAGEM GERADA!`
              },
              {
                type: 'image_url',
                image_url: {
                  url: productImage
                }
              }
            ]
          }
        ],
        modalities: ['image', 'text']
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da API:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Limite de requisições excedido. Tente novamente em alguns segundos.');
      }
      if (response.status === 402) {
        throw new Error('Créditos insuficientes. Adicione créditos ao workspace.');
      }
      
      throw new Error(`Erro ao gerar imagem: ${response.status}`);
    }

    const data = await response.json();
    console.log('Resposta recebida:', JSON.stringify(data).substring(0, 200));

    // Extrair imagem da resposta
    const editedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!editedImage) {
      console.error('Resposta completa:', JSON.stringify(data));
      throw new Error('Nenhuma imagem foi gerada pela IA');
    }

    return new Response(
      JSON.stringify({
        success: true,
        editedImage,
        message: data.choices?.[0]?.message?.content || 'Imagem editada com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro ao processar imagem',
        success: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});
