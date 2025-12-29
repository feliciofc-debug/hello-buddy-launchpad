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

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Resolvendo imagem Amazon para:', url);

    // Extrair ASIN do link Amazon
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
    
    if (asinMatch) {
      const asin = asinMatch[1];
      // URL direta da imagem Amazon usando o padrão conhecido
      const directImageUrl = `https://m.media-amazon.com/images/I/${asin}._AC_SL1500_.jpg`;
      
      console.log('📸 ASIN encontrado:', asin);
      console.log('🖼️ Tentando URL direta:', directImageUrl);
      
      // Verificar se a imagem existe
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
        console.log('⚠️ URL direta não funcionou, tentando scraping...');
      }
    }

    // Fallback: Scraping da página para extrair og:image
    console.log('🌐 Fazendo scraping da página...');
    
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    if (firecrawlKey) {
      // Usar Firecrawl se disponível
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
        
        // Extrair og:image do HTML
        const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                            html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
        
        if (ogImageMatch && ogImageMatch[1]) {
          const imageUrl = ogImageMatch[1];
          console.log('✅ og:image encontrado via Firecrawl:', imageUrl);
          return new Response(
            JSON.stringify({ success: true, imageUrl }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Tentar extrair imagem principal do produto
        const mainImageMatch = html.match(/https:\/\/m\.media-amazon\.com\/images\/I\/[^"'\s]+\.(jpg|jpeg|png)/i);
        if (mainImageMatch) {
          console.log('✅ Imagem principal encontrada:', mainImageMatch[0]);
          return new Response(
            JSON.stringify({ success: true, imageUrl: mainImageMatch[0] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Fallback final: fetch direto (pode falhar por CORS/bot detection)
    console.log('🔄 Tentando fetch direto...');
    
    try {
      const pageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        }
      });

      if (pageResponse.ok) {
        const html = await pageResponse.text();
        
        // Extrair og:image
        const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
        
        if (ogMatch && ogMatch[1]) {
          console.log('✅ og:image encontrado via fetch:', ogMatch[1]);
          return new Response(
            JSON.stringify({ success: true, imageUrl: ogMatch[1] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Tentar imagem do produto
        const imgMatch = html.match(/https:\/\/m\.media-amazon\.com\/images\/I\/[^"'\s]+\.(jpg|jpeg|png)/i);
        if (imgMatch) {
          console.log('✅ Imagem encontrada via regex:', imgMatch[0]);
          return new Response(
            JSON.stringify({ success: true, imageUrl: imgMatch[0] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } catch (fetchErr) {
      console.error('⚠️ Erro no fetch direto:', fetchErr);
    }

    // Nenhuma imagem encontrada
    console.log('❌ Nenhuma imagem encontrada');
    return new Response(
      JSON.stringify({ success: false, error: 'Não foi possível extrair imagem', imageUrl: null }),
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
