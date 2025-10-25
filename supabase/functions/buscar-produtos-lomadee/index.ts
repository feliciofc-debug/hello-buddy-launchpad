import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função para buscar as credenciais do usuário
async function getLomadeeCredentials(supabaseClient: any, userId: string): Promise<{ token: string; sourceId: string }> {
  const { data, error } = await supabaseClient
    .from('integrations')
    .select('lomadee_app_token, lomadee_source_id')
    .eq('user_id', userId)
    .eq('platform', 'lomadee')
    .maybeSingle();

  if (error) {
    console.error('[LOMADEE] Erro ao buscar credenciais:', error);
    throw new Error('Erro ao buscar credenciais da Lomadee.');
  }
  
  if (!data) {
    throw new Error('Integração com a Lomadee não encontrada. Configure suas credenciais na página de Configurações.');
  }
  
  if (!data.lomadee_app_token || !data.lomadee_source_id) {
    throw new Error('Credenciais da Lomadee incompletas. Configure o App Token e Source ID na página de Configurações.');
  }

  return { token: data.lomadee_app_token, sourceId: data.lomadee_source_id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Autenticação: Criar um cliente Supabase usando o token de autorização do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Token de autorização não fornecido.');
    }
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Obter o usuário autenticado
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Usuário não autenticado.');
    }

    console.log('[LOMADEE] Usuário autenticado:', user.id);

    const { searchTerm, categoryId, limit = 50, offset = 0 } = await req.json();

    console.log('[LOMADEE] Buscando produtos:', { searchTerm, categoryId, limit, offset });

    // **MUDANÇA PRINCIPAL: Busca as credenciais do usuário específico**
    const { token: appToken, sourceId } = await getLomadeeCredentials(supabaseClient, user.id);

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

    // Adicionar timeout de 10 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response;
    try {
      response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

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
    
    // Tratamento especial para timeout
    if (error instanceof Error && error.name === 'AbortError') {
      return new Response(JSON.stringify({ 
        error: 'API da Lomadee demorou muito para responder (Timeout).',
        produtos: [],
        total: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 504,
      });
    }
    
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
