import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapa de ASINs para títulos conhecidos (fallback)
const TITULOS_CONHECIDOS: Record<string, { titulo: string; categoria: string }> = {
  'B084KW9K6Y': { titulo: 'Fita Isolante 3M Scotch 33+ Preta 19mm x 20m', categoria: 'Ferramentas' },
  'B0C3HCD34R': { titulo: 'Câmera de Segurança WiFi Full HD', categoria: 'Eletrônicos' },
  'B0D5YZPSJC': { titulo: 'Notebook Gamer ASUS ROG', categoria: 'Informática' },
  'B0F1ZVYWF8': { titulo: 'Kit Panelas Antiaderente 10 Peças', categoria: 'Cozinha' },
  'B076M7Z56P': { titulo: 'Caneta Esferográfica BIC Cristal Preta', categoria: 'Papelaria e Escritório' },
  'B0FW5L4STM': { titulo: 'Smart TV LED 50" 4K UHD', categoria: 'Eletrônicos' },
  'B0CDNH81Y5': { titulo: 'Fone de Ouvido Bluetooth TWS', categoria: 'Eletrônicos' },
  'B086QTH9PF': { titulo: 'Cadeira de Escritório Ergonômica', categoria: 'Móveis' },
  'B07RC171C6': { titulo: 'Cabo USB-C para USB-A 2 metros', categoria: 'Eletrônicos' },
  'B0CNLDVPG4': { titulo: 'Aspirador de Pó Vertical 600W', categoria: 'Eletrodomésticos' },
  'B07MJXM54X': { titulo: 'Organizador de Mesa em Acrílico', categoria: 'Papelaria e Escritório' },
  'B0876VV8KR': { titulo: 'Carregador USB Duplo 2.4A', categoria: 'Eletrônicos' },
  'B0FJHYW5BK': { titulo: 'Fritadeira Air Fryer 5.5L Digital', categoria: 'Eletrodomésticos' },
  'B0FH34Z957': { titulo: 'Suporte de Celular para Carro', categoria: 'Automotivo' },
  'B0DSCBF96L': { titulo: 'Mochila Notebook Impermeável 40L', categoria: 'Moda' },
  'B0FPSHCSQF': { titulo: 'Liquidificador 1000W 3 Velocidades', categoria: 'Eletrodomésticos' },
  'B0CN3HNCPS': { titulo: 'Impressora Multifuncional WiFi', categoria: 'Informática' },
  'B076X77VFC': { titulo: 'Grampeador de Mesa 25 Folhas', categoria: 'Papelaria e Escritório' },
  'B077LJYCSG': { titulo: 'Post-it Bloco Adesivo 76x76mm', categoria: 'Papelaria e Escritório' },
  'B0CJFY1F24': { titulo: 'Monitor LED 24" Full HD', categoria: 'Informática' },
  'B076JKN3TV': { titulo: 'Mouse Sem Fio Wireless 2.4GHz', categoria: 'Informática' },
  'B076Z7K6N1': { titulo: 'Lapiseira 0.7mm Pentel', categoria: 'Papelaria e Escritório' },
  'B09F6V41NR': { titulo: 'Luminária de Mesa LED Articulável', categoria: 'Casa' },
  'B0CJGNFGPQ': { titulo: 'Cafeteira Expresso Automática', categoria: 'Eletrodomésticos' },
  'B093G8NZ4Y': { titulo: 'Fralda Pampers Premium Care M 40un', categoria: 'Bebês' },
  'B0DDTYKDKX': { titulo: 'Travesseiro Viscoelástico NASA', categoria: 'Casa' },
  'B0DFQJQGPL': { titulo: 'Colchonete Fitness Academia', categoria: 'Esportes e Aventura' },
  'B0848FMW1W': { titulo: 'Kit Organizadores de Gaveta 6 Peças', categoria: 'Casa' },
  'B076X6P95W': { titulo: 'Relógio Smartwatch Fitness Tracker', categoria: 'Eletrônicos' },
  'B07H1DLQBY': { titulo: 'Tesoura Escolar Tramontina', categoria: 'Papelaria e Escritório' },
  'B0B7XVVQTB': { titulo: 'Caixa Organizadora Transparente', categoria: 'Casa' },
  'B0F4MNRNDZ': { titulo: 'Headset Gamer com Microfone', categoria: 'Video Game' },
  'B0BZV4QFP8': { titulo: 'Teclado Mecânico RGB', categoria: 'Informática' },
  'B0CY2Z1KPS': { titulo: 'iPhone 15 Pro Max 256GB', categoria: 'Eletrônicos' },
  'B0BSP3D9ZS': { titulo: 'Echo Dot 5ª Geração Alexa', categoria: 'Eletrônicos' },
  'B0G1D6RNV9': { titulo: 'TV OLED 55" 4K Smart', categoria: 'Eletrônicos' },
  'B0G1D3H3RG': { titulo: 'TV OLED 65" 4K Smart', categoria: 'Eletrônicos' },
  'B0BFXJHXDP': { titulo: 'Ventilador de Torre Silencioso', categoria: 'Eletrodomésticos' },
  'B0FHW6KT47': { titulo: 'Capa Protetora iPhone', categoria: 'Eletrônicos' },
  'B08PC81PL3': { titulo: 'Pilha Alcalina AA Duracell 4un', categoria: 'Eletrônicos' },
  'B07253SVVW': { titulo: 'Garrafa Térmica 1 Litro Inox', categoria: 'Cozinha' },
};

// Extrai ASIN do link da Amazon
function extractAsin(url: string): string | null {
  const match = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  return match ? match[1].toUpperCase() : null;
}

// Busca título real da Amazon via scraping
async function fetchAmazonProductTitle(asin: string, scraperApiKey: string): Promise<{ titulo: string; categoria: string } | null> {
  // Primeiro verifica se temos no mapa conhecido
  if (TITULOS_CONHECIDOS[asin]) {
    return TITULOS_CONHECIDOS[asin];
  }

  // Tenta buscar via ScraperAPI
  try {
    const amazonUrl = `https://www.amazon.com.br/dp/${asin}`;
    const scraperUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(amazonUrl)}&country_code=br`;

    const response = await fetch(scraperUrl, { 
      headers: { 'Accept': 'text/html' },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      console.log(`ScraperAPI error for ${asin}: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Extrai título do HTML
    const titlePatterns = [
      /<span[^>]*id="productTitle"[^>]*>([^<]+)</i,
      /<h1[^>]*id="title"[^>]*>[\s\S]*?<span[^>]*>([^<]+)</i,
      /<title>([^|<]+)/i,
    ];

    for (const pattern of titlePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const titulo = match[1].trim()
          .replace(/\s+/g, ' ')
          .replace(/Amazon\.com\.br\s*[:|-]\s*/i, '')
          .substring(0, 200);
        
        if (titulo.length > 10 && !titulo.includes('%') && !titulo.includes('R$')) {
          return { titulo, categoria: 'Casa' }; // Categoria será auto-detectada depois
        }
      }
    }
  } catch (error) {
    console.log(`Error fetching Amazon product ${asin}:`, error);
  }

  return null;
}

// Gera descrição atrativa baseada no título
function gerarDescricaoAtrativa(titulo: string, preco: number): string {
  const emojis = ['🔥', '⚡', '✨', '💥', '🎯', '⭐'];
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];
  
  const chamadas = [
    `${emoji} Oferta imperdível! ${titulo} por apenas R$ ${preco.toFixed(2).replace('.', ',')}! Aproveite!`,
    `${emoji} Super promoção! ${titulo} com preço especial. Compre agora!`,
    `${emoji} ${titulo} - Melhor preço da Amazon! Garantia de qualidade.`,
    `${emoji} Não perca! ${titulo} com desconto exclusivo. Estoque limitado!`,
  ];
  
  return chamadas[Math.floor(Math.random() * chamadas.length)];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const scraperApiKey = Deno.env.get("SCRAPER_API_KEY") || "";
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Busca produtos com títulos corrompidos
    const { data: produtos, error: fetchError } = await supabase
      .from('afiliado_produtos')
      .select('id, titulo, link_afiliado, preco, descricao')
      .ilike('marketplace', '%amazon%')
      .or('titulo.like.%off%Oferta%,titulo.like.%offOferta%,titulo.like.%Termina em%,titulo.like.%R$%R$%')
      .limit(100);

    if (fetchError) {
      throw new Error(`Erro ao buscar produtos: ${fetchError.message}`);
    }

    console.log(`Encontrados ${produtos?.length || 0} produtos para corrigir`);

    const resultados = {
      corrigidos: 0,
      erros: 0,
      detalhes: [] as any[]
    };

    for (const produto of produtos || []) {
      const asin = extractAsin(produto.link_afiliado);
      
      if (!asin) {
        resultados.erros++;
        resultados.detalhes.push({ id: produto.id, erro: 'ASIN não encontrado' });
        continue;
      }

      // Busca dados reais do produto
      const dadosReais = await fetchAmazonProductTitle(asin, scraperApiKey);
      
      if (dadosReais) {
        const novaDescricao = gerarDescricaoAtrativa(dadosReais.titulo, produto.preco || 0);
        
        const { error: updateError } = await supabase
          .from('afiliado_produtos')
          .update({
            titulo: dadosReais.titulo,
            descricao: novaDescricao,
            categoria: dadosReais.categoria
          })
          .eq('id', produto.id);

        if (updateError) {
          resultados.erros++;
          resultados.detalhes.push({ id: produto.id, asin, erro: updateError.message });
        } else {
          resultados.corrigidos++;
          resultados.detalhes.push({ 
            id: produto.id, 
            asin, 
            tituloAntigo: produto.titulo?.substring(0, 50),
            tituloNovo: dadosReais.titulo 
          });
        }
      } else {
        resultados.erros++;
        resultados.detalhes.push({ id: produto.id, asin, erro: 'Não foi possível obter título' });
      }

      // Delay para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Corrigidos ${resultados.corrigidos} de ${produtos?.length || 0} produtos`,
        resultados
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
