import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchTerm, categoryId, limit = 50, offset = 0 } = await req.json();
    
    const appToken = Deno.env.get("LOMADEE_APP_TOKEN");
    const sourceId = Deno.env.get("LOMADEE_SOURCE_ID");
    
    if (!appToken || !sourceId) {
      console.error("[LOMADEE] API credentials não configuradas");
      throw new Error("API credentials não configuradas. Configure LOMADEE_APP_TOKEN e LOMADEE_SOURCE_ID");
    }

    console.log("[LOMADEE] Buscando produtos:", { searchTerm, categoryId, limit, offset });

    // Construir URL da API Lomadee
    let apiUrl = `https://api.lomadee.com/v3/${appToken}/product/_search`;
    const params = new URLSearchParams({
      sourceId: sourceId,
      size: limit.toString(),
      page: (Math.floor(offset / limit) + 1).toString(),
    });

    if (searchTerm) {
      params.append("keyword", searchTerm);
    }

    if (categoryId) {
      params.append("categoryId", categoryId);
    }

    apiUrl += `?${params.toString()}`;

    console.log("[LOMADEE] URL da API:", apiUrl);

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[LOMADEE] Erro na API:", response.status, errorText);
      throw new Error(`Erro na API Lomadee: ${response.status}`);
    }

    const data = await response.json();
    console.log("[LOMADEE] Produtos encontrados:", data.products?.length || 0);

    // Transformar dados para o formato do app
    const produtos = (data.products || []).map((produto: any) => {
      // Calcular comissão (Lomadee usa % de comissão)
      const preco = produto.price?.min || 0;
      const comissaoPercentual = produto.commission?.max || 0;
      const comissao = (preco * comissaoPercentual) / 100;

      return {
        id: `lomadee_${produto.id}`,
        nome: produto.name || "Produto sem nome",
        asin: produto.id?.toString() || "",
        url: produto.link?.value || "#",
        imagem: produto.thumbnail?.url || "https://via.placeholder.com/400",
        preco: preco,
        comissao: comissao,
        rating: produto.rating?.average || 0,
        reviews: produto.rating?.total || 0,
        demandaMensal: 0, // Lomadee não fornece esse dado
        categoria: produto.category?.name || "Outros",
        dataCadastro: new Date().toISOString(),
        marketplace: "Lomadee",
        comissaoPercentual: comissaoPercentual,
      };
    });

    return new Response(JSON.stringify({ 
      produtos,
      total: data.totalProducts || produtos.length,
      page: data.page || 1,
      totalPages: data.totalPages || 1,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[LOMADEE] Erro:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error),
      produtos: [],
      total: 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
