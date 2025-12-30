import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Termos que indicam imagens ruins (banners, tarjas, logos, etc.)
const IMAGENS_IGNORAR = [
  '/banner',
  '/nav-',
  '/logo',
  '/sprite',
  '/icon',
  '_SS40_',
  '_SS50_',
  '_SS60_',
  '_SS80_',
  '_SS100_',
  '_SS115_',  // Thumbnails pequenos
  '_AC_SR',   // Imagens recortadas/banner
  '_AC_US',   // Imagens de UI
  'transparent-pixel',
  'blank.gif',
  'loading',
  'spinner',
];

function isImagemValida(url: string): boolean {
  if (!url) return false;
  
  // Verificar se contém termos ruins
  const ehRuim = IMAGENS_IGNORAR.some(termo => url.includes(termo));
  if (ehRuim) {
    console.log('⚠️ Imagem ignorada (termo ruim):', url.substring(0, 100));
    return false;
  }
  
  // Deve ser uma imagem Amazon válida
  if (!url.includes('m.media-amazon.com/images/I/')) {
    console.log('⚠️ Imagem ignorada (não é Amazon):', url.substring(0, 100));
    return false;
  }
  
  return true;
}

function extrairImagemPrincipal(html: string): string | null {
  console.log('🔍 Procurando imagem principal no HTML...');
  
  // Padrões ordenados por prioridade (imagem principal primeiro)
  const patterns = [
    // Padrão 1: landingImage (imagem principal do produto)
    /"landingImage"\s*:\s*"(https:[^"]+)"/,
    
    // Padrão 2: hiRes (alta resolução)
    /"hiRes"\s*:\s*"(https:[^"]+)"/,
    
    // Padrão 3: mainImage (imagem principal)
    /"mainImage"\s*:\s*"(https:[^"]+)"/,
    
    // Padrão 4: large (imagem grande)
    /"large"\s*:\s*"(https:[^"]+)"/,
    
    // Padrão 5: og:image (meta tag - geralmente imagem principal)
    /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i,
    
    // Padrão 6: data-old-hires (atributo de imagem)
    /data-old-hires=["']([^"']+)["']/,
    
    // Padrão 7: Imagem grande no formato padrão Amazon (AC_SL1500 = alta qualidade)
    /(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%+-]+\._AC_SL1500_\.jpg)/,
    /(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%+-]+\._AC_SL1200_\.jpg)/,
    /(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%+-]+\._AC_SL1000_\.jpg)/,
    /(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%+-]+\._AC_SL800_\.jpg)/,
    /(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%+-]+\._AC_SL500_\.jpg)/,
    
    // Padrão 8: Qualquer imagem Amazon grande
    /(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%+-]+\._AC_[^"'\s]+\.jpg)/,
  ];
  
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = html.match(pattern);
    
    if (match && match[1]) {
      let imageUrl = match[1];
      
      // Decodificar URL se necessário
      if (imageUrl.includes('\\u')) {
        try {
          imageUrl = JSON.parse(`"${imageUrl}"`);
        } catch (e) {
          // Ignorar erro de parse
        }
      }
      
      // Validar imagem
      if (isImagemValida(imageUrl)) {
        console.log(`✅ Imagem encontrada (padrão ${i + 1}):`, imageUrl.substring(0, 100));
        return imageUrl;
      }
    }
  }
  
  console.log('❌ Nenhuma imagem principal encontrada nos padrões');
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Resolvendo imagem Amazon para:', url);

    // Extrair ASIN do link Amazon
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i) || 
                      url.match(/\/gp\/product\/([A-Z0-9]{10})/i) ||
                      url.match(/\/d\/([A-Z0-9]{10})/i) ||
                      url.match(/amazon\.com\.br\/[^\/]+\/([A-Z0-9]{10})/i);
    
    const asin = asinMatch ? asinMatch[1] : null;
    console.log('📦 ASIN extraído:', asin);

    // Tentar Firecrawl primeiro (melhor para pegar HTML completo)
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    if (firecrawlKey) {
      console.log('🌐 Usando Firecrawl para scraping...');
      
      try {
        const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: url,
            formats: ['html'],
            onlyMainContent: false,
          }),
        });

        if (scrapeResponse.ok) {
          const scrapeData = await scrapeResponse.json();
          const html = scrapeData.data?.html || scrapeData.html || '';
          
          console.log('📄 HTML recebido, tamanho:', html.length);
          
          const imageUrl = extrairImagemPrincipal(html);
          
          if (imageUrl) {
            return new Response(
              JSON.stringify({ success: true, imageUrl }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          console.log('⚠️ Firecrawl retornou erro:', scrapeResponse.status);
        }
      } catch (e) {
        console.error('⚠️ Erro no Firecrawl:', e);
      }
    }

    // Fallback: Fetch direto
    console.log('🔄 Tentando fetch direto...');
    
    try {
      const pageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
        }
      });

      if (pageResponse.ok) {
        const html = await pageResponse.text();
        console.log('📄 HTML recebido via fetch, tamanho:', html.length);
        
        const imageUrl = extrairImagemPrincipal(html);
        
        if (imageUrl) {
          return new Response(
            JSON.stringify({ success: true, imageUrl }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } catch (fetchErr) {
      console.error('⚠️ Erro no fetch direto:', fetchErr);
    }

    // Último fallback: Construir URL baseado no ASIN (imagem grande padrão)
    if (asin) {
      // Tentar diferentes sufixos de imagem grande
      const sufixos = ['_AC_SL1500_', '_AC_SL1200_', '_AC_SL1000_', '_AC_SL800_', '_AC_SL500_'];
      
      for (const sufixo of sufixos) {
        const directImageUrl = `https://m.media-amazon.com/images/I/${asin}.${sufixo}.jpg`;
        
        console.log('🖼️ Tentando URL direta:', directImageUrl);
        
        try {
          const imgCheck = await fetch(directImageUrl, { method: 'HEAD' });
          if (imgCheck.ok) {
            console.log('✅ Imagem direta válida!');
            return new Response(
              JSON.stringify({ success: true, imageUrl: directImageUrl }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (e) {
          // Continuar tentando
        }
      }
    }

    // Nenhuma imagem encontrada
    console.log('❌ Nenhuma imagem encontrada após todas as tentativas');
    return new Response(
      JSON.stringify({ success: false, error: 'Não foi possível extrair imagem principal', imageUrl: null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
