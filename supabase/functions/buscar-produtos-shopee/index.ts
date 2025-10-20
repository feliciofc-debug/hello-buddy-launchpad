import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createHmac } from "node:crypto";

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
    
    const partnerId = Deno.env.get("SHOPEE_APP_ID");
    const partnerKey = Deno.env.get("SHOPEE_PARTNER_KEY");
    const shopId = Deno.env.get("SHOPEE_SHOP_ID");
    const accessToken = Deno.env.get("SHOPEE_ACCESS_TOKEN");
    
    if (!partnerId || !partnerKey) {
      console.error("[SHOPEE] API credentials não configuradas");
      throw new Error("API credentials não configuradas. Configure SHOPEE_APP_ID e SHOPEE_PARTNER_KEY");
    }

    // Se não tiver access_token, usar endpoints públicos
    // Se tiver access_token e shop_id, usar endpoints autenticados
    const useAuth = !!(accessToken && shopId);

    console.log("[SHOPEE] Buscando produtos:", { searchTerm, categoryId, limit, offset });

    // Gerar assinatura para autenticação Shopee
    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/api/v2/product/get_item_list";
    
    // Montar base string conforme documentação Shopee
    // Para endpoints autenticados: partner_id + path + timestamp + access_token + shop_id
    // Para endpoints públicos: partner_id + path + timestamp
    let baseString = `${partnerId}${path}${timestamp}`;
    if (useAuth) {
      baseString += accessToken + shopId;
    }
    
    const sign = createHmac("sha256", partnerKey)
      .update(baseString)
      .digest("hex");
    
    console.log("[SHOPEE] Auth:", useAuth ? "Autenticado" : "Público");

    // Construir URL da API Shopee
    const apiUrl = `https://partner.shopeemobile.com${path}`;
    const params = new URLSearchParams({
      partner_id: partnerId,
      timestamp: timestamp.toString(),
      sign: sign,
      page_size: limit.toString(),
      offset: offset.toString(),
    });

    // Adicionar parâmetros autenticados se disponível
    if (useAuth) {
      params.append("access_token", accessToken!);
      params.append("shop_id", shopId!);
      params.append("item_status", "NORMAL"); // Apenas produtos ativos
    }

    console.log("[SHOPEE] URL da API:", `${apiUrl}?${params.toString()}`);

    const response = await fetch(`${apiUrl}?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[SHOPEE] Erro na API:", response.status, errorText);
      throw new Error(`Erro na API Shopee: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      console.error("[SHOPEE] Erro retornado pela API:", data.message);
      throw new Error(`Erro Shopee: ${data.message}`);
    }

    console.log("[SHOPEE] Produtos encontrados:", data.response?.item?.length || 0);

    // Transformar dados para o formato do app
    const produtos = (data.response?.item || []).map((produto: any) => {
      // Shopee retorna preço em centavos
      const preco = (produto.price?.original_price || 0) / 100000;
      const precoPromocional = (produto.price?.current_price || preco * 100000) / 100000;
      
      // Calcular comissão (normalmente 2-5% na Shopee)
      const comissaoPercentual = 3; // Default 3%
      const comissao = (precoPromocional * comissaoPercentual) / 100;

      return {
        id: `shopee_${produto.item_id}`,
        nome: produto.item_name || "Produto sem nome",
        asin: produto.item_id?.toString() || "",
        url: `https://shopee.com.br/product/${shopId}/${produto.item_id}`,
        imagem: produto.image?.image_url_list?.[0] || "https://via.placeholder.com/400",
        preco: precoPromocional,
        precoOriginal: preco !== precoPromocional ? preco : undefined,
        comissao: comissao,
        rating: produto.rating_star || 0,
        reviews: produto.comment_count || 0,
        demandaMensal: produto.sold || 0,
        categoria: produto.category_name || "Outros",
        dataCadastro: new Date().toISOString(),
        marketplace: "Shopee",
        comissaoPercentual: comissaoPercentual,
        estoque: produto.stock || 0,
      };
    });

    return new Response(JSON.stringify({ 
      produtos,
      total: data.response?.total_count || produtos.length,
      hasMore: data.response?.has_next_page || false,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[SHOPEE] Erro:", error);
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
