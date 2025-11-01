import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extrairImagem(html: string, url: string): string {
  const urlObj = new URL(url);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
  
  // PRIORIDADE 1: Open Graph Image
  const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  if (ogMatch && isValidProductImage(ogMatch[1])) {
    return completeUrl(ogMatch[1], baseUrl);
  }
  
  // PRIORIDADE 2: Twitter Card
  const twitterMatch = html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);
  if (twitterMatch && isValidProductImage(twitterMatch[1])) {
    return completeUrl(twitterMatch[1], baseUrl);
  }
  
  // PRIORIDADE 3: Procurar por imagens grandes no HTML
  const imgMatches = html.match(/<img[^>]+src="([^"]+)"[^>]*>/gi) || [];
  for (const imgTag of imgMatches) {
    const srcMatch = imgTag.match(/src="([^"]+)"/i);
    if (srcMatch && isValidProductImage(srcMatch[1])) {
      return completeUrl(srcMatch[1], baseUrl);
    }
  }
  
  // FALLBACK: Placeholder
  return 'https://via.placeholder.com/400x400/6366f1/FFFFFF?text=Produto';
}

function isValidProductImage(url: string): boolean {
  const lower = url.toLowerCase();
  
  // Excluir logos, ícones, sprites
  const excludePatterns = ['logo', 'icon', 'sprite', 'avatar', 'button', 'banner'];
  if (excludePatterns.some(pattern => lower.includes(pattern))) {
    return false;
  }
  
  // Priorizar URLs com palavras-chave de produto
  const productPatterns = ['product', 'item', 'images', 'media', 'catalog', 'goods'];
  if (productPatterns.some(pattern => lower.includes(pattern))) {
    return true;
  }
  
  // Aceitar se for imagem comum e não estiver na lista de exclusão
  return lower.match(/\.(jpg|jpeg|png|webp)/) !== null;
}

function completeUrl(imageUrl: string, baseUrl: string): string {
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }
  if (imageUrl.startsWith('//')) {
    return `https:${imageUrl}`;
  }
  if (imageUrl.startsWith('/')) {
    return `${baseUrl}${imageUrl}`;
  }
  return imageUrl;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, uploadedImage } = await req.json();
    console.log('Analisando URL:', url);

    if (!url) {
      throw new Error('URL não fornecida');
    }

    // 1. BUSCAR DADOS DO PRODUTO
    let titulo = 'Produto em Oferta';
    let preco = '99.90';
    let imagem = uploadedImage || '';

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const html = await response.text();

      // Extrair título
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) || 
                        html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (titleMatch) {
        titulo = titleMatch[1].trim().substring(0, 100);
      }

      // Extrair preço
      const precoMatch = html.match(/R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/);
      if (precoMatch) {
        preco = precoMatch[1].replace('.', '').replace(',', '.');
      }

      // Extrair imagem apenas se não foi feito upload
      if (!uploadedImage) {
        // Links curtos Amazon não têm HTML rico
        if (url.includes('amzn.to') || url.includes('a.co')) {
          console.log('Link curto Amazon detectado - usando placeholder');
          imagem = 'https://via.placeholder.com/400x400/FF9900/FFFFFF?text=Amazon+Product';
        } else {
          imagem = extrairImagem(html, url);
        }
      }

      console.log('Dados extraídos:', { titulo, preco, imagem, url });
    } catch (error) {
      console.log('Erro ao parsear, usando dados genéricos:', error);
    }

    // 2. GERAR POSTS COM LOVABLE AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const promptInsta = `Produto: ${titulo}, Preço: R$${preco}. 
Crie um post para Instagram (máximo 150 caracteres) com linguagem vendedora, emojis relevantes e call-to-action forte. Seja persuasivo e urgente.`;

    const promptStory = `Produto: ${titulo}, R$${preco}. 
Crie um texto para story do Instagram (máximo 80 caracteres) com senso de urgência e escassez. Use emojis e seja direto.`;

    const promptWhats = `Produto: ${titulo}, R$${preco}. 
Crie uma mensagem para WhatsApp como se fosse um amigo indicando o produto. Seja informal, amigável e convincente (máximo 200 caracteres).`;

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
            { role: 'system', content: 'Você é um especialista em copywriting para afiliados. Crie textos persuasivos e vendedores.' },
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

    console.log('Posts gerados com sucesso');

    // 3. RETORNAR
    return new Response(
      JSON.stringify({
        success: true,
        produto: {
          titulo,
          preco,
          imagem,
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
    console.error('Erro na função analisar-produto:', error);
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
