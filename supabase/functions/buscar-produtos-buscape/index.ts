import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { keyword, storeName } = await req.json();
    
    console.log("[BUSCAPE] Buscando produtos:", { keyword, storeName });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Obter token da Lomadee da integração do usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Não autenticado");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Usuário não autenticado");
    }

    const { data: integration } = await supabaseClient
      .from('integrations')
      .select('lomadee_app_token, lomadee_source_id')
      .eq('user_id', user.id)
      .eq('platform', 'lomadee')
      .eq('is_active', true)
      .single();

    if (!integration?.lomadee_app_token) {
      throw new Error("Configure sua integração Lomadee primeiro");
    }

    const lomadeeToken = integration.lomadee_app_token;
    const sourceId = integration.lomadee_source_id;

    // Buscar produtos via BuscaPé API (PRODUÇÃO)
    // Usar apenas os primeiros source IDs para evitar URL muito longa
    const firstSourceId = sourceId ? sourceId.split(',')[0] : sourceId;
    
    const buscapeUrl = `http://bws.buscape.com.br/service/findProductList/lomadee/${lomadeeToken}/${firstSourceId}/?keyword=${encodeURIComponent(keyword)}&format=json`;
    
    console.log("[BUSCAPE] Chamando API:", buscapeUrl);

    const response = await fetch(buscapeUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[BUSCAPE] Erro na API:", response.status, errorText);
      throw new Error(`Erro ao buscar produtos: ${response.status}`);
    }

    const data = await response.json();
    console.log("[BUSCAPE] Resposta recebida:", JSON.stringify(data).substring(0, 500));

    // Processar produtos
    let produtos = [];
    
    if (data.produto) {
      produtos = Array.isArray(data.produto) ? data.produto : [data.produto];
    } else if (data.product) {
      produtos = Array.isArray(data.product) ? data.product : [data.product];
    }

    // Transformar para o formato esperado pelo frontend
    const produtosFormatados = produtos.map((produto: any, index: number) => {
      const preco = parseFloat(produto.preco?.valor || produto.price?.min || 0);
      const comissao = preco * 0.05; // Estimativa de 5% - ajustar conforme loja
      
      return {
        id: produto.id || `buscape-${index}`,
        title: produto.nome || produto.productname || 'Produto sem nome',
        description: produto.descricao || produto.productshortname || '',
        price: preco,
        commission: comissao,
        commissionPercent: 5,
        marketplace: 'lomadee',
        category: produto.categoria?.nome || produto.category?.name || '🏠 Casa e Cozinha',
        imageUrl: produto.imagem || produto.thumbnail?.url || 'https://via.placeholder.com/300',
        affiliateLink: produto.link || produto.links?.produto || '#',
        rating: parseFloat(produto.avaliacaomedia || produto.rating?.average || 0),
        reviews: parseInt(produto.numeroavaliacoes || produto.rating?.count || 0),
        sales: 0,
        createdAt: new Date().toISOString(),
        bsr: 0,
        bsrCategory: 'Product'
      };
    });

    console.log(`[BUSCAPE] ✅ ${produtosFormatados.length} produtos formatados`);

    return new Response(
      JSON.stringify({ 
        success: true,
        products: produtosFormatados,
        totalFound: produtosFormatados.length 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[BUSCAPE] Erro:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        products: []
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
