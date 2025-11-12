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
    if (!authHeader) throw new Error("Não autenticado");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Não autenticado");

    const { campanha_id, limite = 50 } = await req.json();

    console.log(`[GENERATE-LEADS-B2C] Iniciando para campanha ${campanha_id}`);

    // Buscar campanha e ICP
    const { data: campanha, error: campanhaError } = await supabaseClient
      .from('campanhas_prospeccao')
      .select('*, icp_configs(*)')
      .eq('id', campanha_id)
      .single();

    if (campanhaError) throw campanhaError;
    if (!campanha.icp_configs) throw new Error("ICP não encontrado");

    const icp = campanha.icp_configs;
    const b2cConfig = icp.b2c_config as any;

    console.log("[GENERATE-LEADS-B2C] ICP Config:", b2cConfig);

    // Criar execução
    const { data: execucao } = await supabaseClient
      .from('campanha_execucoes')
      .insert({
        campanha_id,
        tipo: 'descoberta_b2c',
        status: 'processando'
      })
      .select()
      .single();

    // Gerar queries de busca
    const queries: string[] = [];
    
    for (const profissao of b2cConfig.profissoes || []) {
      for (const cidade of b2cConfig.cidades || []) {
        for (const sinal of b2cConfig.sinais_poder_aquisitivo || []) {
          queries.push(`${profissao} ${cidade} ${sinal}`);
        }
      }
    }

    console.log(`[GENERATE-LEADS-B2C] ${queries.length} queries geradas`);

    // Buscar no Google
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

    // Extrair nome de profissional do snippet/title
    const extractNome = (title: string, snippet: string): string | null => {
      const text = `${title} ${snippet}`;
      
      // Procurar padrões: Dr. João Silva, Dra. Maria, etc
      const patterns = [
        /Dr\.?\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)+)/,
        /Dra\.?\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)+)/,
        /([A-ZÀ-Ú][a-zà-ú]+\s+[A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)\s+-\s+(?:Médico|Advogado|Dentista)/i
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1];
      }

      return null;
    };

    let totalEncontrados = 0;
    const leadsCriados = [];

    for (const query of queries.slice(0, Math.min(limite / 10, queries.length))) {
      console.log(`[GENERATE-LEADS-B2C] Buscando: ${query}`);
      
      try {
        const results = await googleSearch(query);
        
        for (const item of results.items || []) {
          const nome = extractNome(item.title, item.snippet);
          
          if (nome) {
            // Verificar se já existe
            const { data: existente } = await supabaseClient
              .from('leads_descobertos')
              .select('id')
              .eq('nome_profissional', nome)
              .eq('user_id', user.id)
              .single();

            if (!existente) {
              const { data: lead } = await supabaseClient
                .from('leads_descobertos')
                .insert({
                  campanha_id,
                  user_id: user.id,
                  tipo: 'b2c',
                  nome_profissional: nome,
                  profissao: b2cConfig.profissoes[0],
                  cidade: b2cConfig.cidades[0],
                  estado: b2cConfig.estados[0],
                  fonte: 'google_search',
                  fonte_url: item.link,
                  fonte_snippet: item.snippet,
                  query_usada: query,
                  status: 'descoberto'
                })
                .select()
                .single();

              if (lead) {
                leadsCriados.push(lead);
                totalEncontrados++;
                console.log(`[GENERATE-LEADS-B2C] ✅ Lead criado: ${nome}`);
              }
            }
          }
        }

        // Delay entre queries para não estourar rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[GENERATE-LEADS-B2C] Erro na query "${query}":`, error);
      }
    }

    // Atualizar execução
    await supabaseClient
      .from('campanha_execucoes')
      .update({
        status: 'concluida',
        total_items: queries.length,
        processados: queries.length,
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

    console.log(`[GENERATE-LEADS-B2C] ✅ Concluído! ${totalEncontrados} leads descobertos`);

    return new Response(JSON.stringify({
      success: true,
      total_encontrados: totalEncontrados,
      leads: leadsCriados,
      execucao_id: execucao.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[GENERATE-LEADS-B2C] Erro:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
