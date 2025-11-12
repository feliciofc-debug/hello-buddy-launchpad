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
    const authHeader = req.headers.get("authorization");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { authorization: authHeader! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Não autenticado");

    const { campanha_id, limite = 50 } = await req.json();

    console.log(`[GENERATE-LEADS-B2B] Iniciando para campanha ${campanha_id}`);

    // Buscar campanha e ICP
    const { data: campanha, error: campanhaError } = await supabaseClient
      .from('campanhas_prospeccao')
      .select('*, icp_configs(*)')
      .eq('id', campanha_id)
      .single();

    if (campanhaError) throw campanhaError;
    if (!campanha.icp_configs) throw new Error("ICP não encontrado");

    const icp = campanha.icp_configs;
    const b2bConfig = icp.b2b_config as any;

    console.log("[GENERATE-LEADS-B2B] ICP Config:", b2bConfig);

    // Criar execução
    const { data: execucao } = await supabaseClient
      .from('campanha_execucoes')
      .insert({
        campanha_id,
        tipo: 'descoberta_b2b',
        status: 'processando'
      })
      .select()
      .single();

    // Buscar empresas via Google (CNPJs públicos)
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const GOOGLE_CX = Deno.env.get("GOOGLE_CX");

    if (!GOOGLE_API_KEY || !GOOGLE_CX) {
      throw new Error("Google API não configurada");
    }

    const googleSearch = async (query: string) => {
      const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      return await response.json();
    };

    // Extrair CNPJ do texto
    const extractCNPJ = (text: string): string | null => {
      const cnpjPattern = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;
      const match = text.match(cnpjPattern);
      if (match) {
        return match[0].replace(/\D/g, '');
      }
      return null;
    };

    // Gerar queries baseadas no ICP
    const queries: string[] = [];
    
    for (const setor of b2bConfig.setores || []) {
      for (const cidade of b2bConfig.cidades || []) {
        queries.push(`empresas ${setor} ${cidade} CNPJ site:gov.br`);
        queries.push(`${setor} ${cidade} razão social CNPJ`);
      }
    }

    console.log(`[GENERATE-LEADS-B2B] ${queries.length} queries geradas`);

    let totalEncontrados = 0;
    const cnpjsEncontrados = new Set<string>();

    for (const query of queries.slice(0, Math.min(10, queries.length))) {
      console.log(`[GENERATE-LEADS-B2B] Buscando: ${query}`);
      
      try {
        const results = await googleSearch(query);
        
        for (const item of results.items || []) {
          const cnpj = extractCNPJ(`${item.title} ${item.snippet}`);
          
          if (cnpj && !cnpjsEncontrados.has(cnpj)) {
            cnpjsEncontrados.add(cnpj);

            // Verificar se já existe
            const { data: existente } = await supabaseClient
              .from('leads_descobertos')
              .select('id')
              .eq('cnpj', cnpj)
              .eq('user_id', user.id)
              .single();

            if (!existente) {
              // Buscar dados da empresa na Brasil API
              try {
                const brasilApiUrl = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;
                const empresaResponse = await fetch(brasilApiUrl);
                
                if (empresaResponse.ok) {
                  const empresaData = await empresaResponse.json();

                  // Verificar filtros do ICP
                  const matchesICP = (
                    (!b2bConfig.capital_minimo || empresaData.capital_social >= b2bConfig.capital_minimo) &&
                    (!b2bConfig.situacao || b2bConfig.situacao.includes(empresaData.descricao_situacao_cadastral))
                  );

                  if (matchesICP) {
                    const { data: lead } = await supabaseClient
                      .from('leads_descobertos')
                      .insert({
                        campanha_id,
                        user_id: user.id,
                        tipo: 'b2b',
                        cnpj,
                        razao_social: empresaData.razao_social,
                        nome_fantasia: empresaData.nome_fantasia,
                        cidade: empresaData.municipio,
                        estado: empresaData.uf,
                        fonte: 'google_search',
                        fonte_url: item.link,
                        fonte_snippet: item.snippet,
                        query_usada: query,
                        status: 'descoberto'
                      })
                      .select()
                      .single();

                    if (lead) {
                      totalEncontrados++;
                      console.log(`[GENERATE-LEADS-B2B] ✅ Lead criado: ${empresaData.razao_social}`);
                    }
                  }
                }
              } catch (error) {
                console.error(`[GENERATE-LEADS-B2B] Erro ao buscar CNPJ ${cnpj}:`, error);
              }
            }

            if (totalEncontrados >= limite) break;
          }
        }

        // Delay entre queries
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[GENERATE-LEADS-B2B] Erro na query "${query}":`, error);
      }

      if (totalEncontrados >= limite) break;
    }

    // Atualizar execução
    await supabaseClient
      .from('campanha_execucoes')
      .update({
        status: 'concluida',
        total_items: cnpjsEncontrados.size,
        processados: cnpjsEncontrados.size,
        sucesso: totalEncontrados,
        concluida_em: new Date().toISOString()
      })
      .eq('id', execucao.id);

    // Atualizar stats da campanha
    const stats = campanha.stats as any;
    await supabaseClient
      .from('campanhas_prospeccao')
      .update({
        stats: {
          ...stats,
          descobertos: (stats.descobertos || 0) + totalEncontrados
        }
      })
      .eq('id', campanha_id);

    console.log(`[GENERATE-LEADS-B2B] ✅ Concluído! ${totalEncontrados} leads descobertos`);

    return new Response(JSON.stringify({
      success: true,
      total_encontrados: totalEncontrados,
      execucao_id: execucao.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[GENERATE-LEADS-B2B] Erro:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
