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

  console.log("🚀 === GENERATE-LEADS-B2C INICIADO ===");

  try {
    // LOG 1: Body recebido
    const body = await req.json();
    console.log("📦 Body:", JSON.stringify(body, null, 2));

    const { campanha_id, icp_config_id, limite = 50 } = body;
    console.log(`✅ Params extraídos:`, { campanha_id, icp_config_id, limite });

    // LOG 2: Verificar credenciais
    console.log("🔑 Verificando credenciais...");
    console.log("SUPABASE_URL:", Deno.env.get("SUPABASE_URL") ? "✅" : "❌");
    console.log("SUPABASE_SERVICE_ROLE_KEY:", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? "✅" : "❌");
    console.log("GOOGLE_API_KEY:", Deno.env.get("GOOGLE_API_KEY") ? "✅" : "❌");
    console.log("GOOGLE_CX:", Deno.env.get("GOOGLE_CX") ? "✅" : "❌");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("✅ Supabase client criado com SERVICE_ROLE");

    // Buscar campanha com logs detalhados
    console.log("📋 Buscando campanha...");
    console.log("🔍 campanha_id:", campanha_id);
    
    const { data: campanha, error: campanhaError } = await supabaseClient
      .from('campanhas_prospeccao')
      .select('*, icp_configs(*)')
      .eq('id', campanha_id)
      .maybeSingle();

    console.log("📊 Resultado da query:");
    console.log("  - Error:", campanhaError);
    console.log("  - Data:", campanha);

    if (campanhaError) {
      console.error("❌ Erro ao buscar campanha:", campanhaError);
      throw new Error(`Erro ao buscar campanha: ${campanhaError.message}`);
    }

    if (!campanha) {
      console.error("❌ Campanha não encontrada no banco");
      console.error("❌ ID buscado:", campanha_id);
      throw new Error("Campanha não encontrada");
    }

    console.log("✅ Campanha encontrada:", campanha.nome);
    console.log("✅ user_id da campanha:", campanha.user_id);

    if (!campanha.icp_configs) {
      console.error("❌ ICP não encontrado na campanha");
      throw new Error("ICP não encontrado");
    }

    const icp = campanha.icp_configs;
    const b2cConfig = icp.b2c_config as any;

    console.log("✅ ICP carregado:", icp.nome);
    console.log("📊 ICP tipo:", icp.tipo);
    console.log("📊 B2C config:", JSON.stringify(b2cConfig, null, 2));

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

    // Gerar queries de busca usando IA se os campos estiverem vazios
    let queries: string[] = [];
    
    console.log("[GENERATE-LEADS-B2C] 🔍 Verificando dados estruturados...");
    console.log("[GENERATE-LEADS-B2C]   - profissoes:", b2cConfig.profissoes);
    console.log("[GENERATE-LEADS-B2C]   - cidades:", b2cConfig.cidades);
    console.log("[GENERATE-LEADS-B2C]   - descricao ICP:", icp.descricao);
    
    const hasDadosEstruturados = 
      (b2cConfig.profissoes?.length > 0) && 
      (b2cConfig.cidades?.length > 0);

    console.log("[GENERATE-LEADS-B2C]   - hasDadosEstruturados:", hasDadosEstruturados);
    console.log("[GENERATE-LEADS-B2C]   - Vai usar IA?", !hasDadosEstruturados && icp.descricao);

    if (!hasDadosEstruturados && icp.descricao) {
      console.log(`[GENERATE-LEADS-B2C] 🤖 Usando IA para gerar queries da descrição: "${icp.descricao}"`);
      
      // Usar IA para extrair informações e gerar queries
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      if (LOVABLE_API_KEY) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout para IA
          
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content: "Você é um assistente especializado em gerar queries de busca para encontrar profissionais. Extraia informações da descrição e gere 5-8 queries de busca eficientes para Google Search."
                },
                {
                  role: "user",
                  content: `Descrição do público-alvo: "${icp.descricao}"
                  
Gere queries de busca para encontrar esses profissionais no Google. Inclua:
- Profissão + cidade
- Profissão + bairro + cidade
- Profissão + especialidade + cidade
- Redes sociais (LinkedIn, Instagram)
- Diretórios profissionais

Retorne APENAS um JSON array com as queries, sem explicações:
["query1", "query2", ...]`
                }
              ],
              tools: [{
                type: "function",
                function: {
                  name: "generate_queries",
                  description: "Gera queries de busca",
                  parameters: {
                    type: "object",
                    properties: {
                      queries: {
                        type: "array",
                        items: { type: "string" },
                        description: "Lista de queries de busca"
                      }
                    },
                    required: ["queries"]
                  }
                }
              }],
              tool_choice: { type: "function", function: { name: "generate_queries" } }
            })
          });

          clearTimeout(timeout);
          const aiData = await aiResponse.json();
          console.log("[GENERATE-LEADS-B2C] 🤖 Resposta da IA:", JSON.stringify(aiData));
          
          if (aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
            const args = JSON.parse(aiData.choices[0].message.tool_calls[0].function.arguments);
            queries = args.queries || [];
            console.log(`[GENERATE-LEADS-B2C] 🤖 ${queries.length} queries geradas pela IA`);
          }
        } catch (aiError) {
          console.error("[GENERATE-LEADS-B2C] ⚠️ Erro na IA, usando fallback:", aiError);
        }
      }
      
      // Fallback: queries básicas baseadas na descrição
      if (queries.length === 0) {
        const descricao = icp.descricao.toLowerCase();
        const profissoes = ["médico", "medico", "dr", "dra"];
        const cidades = ["rio de janeiro", "rj"];
        
        for (const prof of profissoes) {
          if (descricao.includes(prof)) {
            queries.push(`${prof} rio de janeiro linkedin`);
            queries.push(`${prof} zona sul rio de janeiro`);
            queries.push(`${prof} consultório rio de janeiro`);
            queries.push(`${prof} CRM rio de janeiro`);
            break;
          }
        }
      }
    } else {
      // Usar dados estruturados
      for (const profissao of b2cConfig.profissoes || []) {
        for (const cidade of b2cConfig.cidades || []) {
          queries.push(`${profissao} ${cidade} linkedin`);
          queries.push(`${profissao} ${cidade} consultório`);
          
          for (const sinal of b2cConfig.sinais_poder_aquisitivo || []) {
            queries.push(`${profissao} ${cidade} ${sinal}`);
          }
        }
      }
    }

    console.log(`[GENERATE-LEADS-B2C] 📝 ${queries.length} queries geradas:`, queries);

    // Buscar no Google
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const GOOGLE_CX = Deno.env.get("GOOGLE_CX");

    if (!GOOGLE_API_KEY || !GOOGLE_CX) {
      throw new Error("Google API não configurada");
    }

    const googleSearch = async (query: string) => {
      const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
      
      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        return await response.json();
      } catch (error) {
        clearTimeout(timeout);
        console.error(`[GENERATE-LEADS-B2C] Erro no Google Search para "${query}":`, error);
        return { items: [] };
      }
    };

    // Extrair informações de profissional do resultado - VERSÃO RIGOROSA
    const extractLeadInfo = (title: string, snippet: string, link: string) => {
      const text = `${title} ${snippet}`;
      const textoLower = text.toLowerCase();
      
      // ========== LISTA EXPANDIDA DE EXCLUSÃO ==========
      const palavrasProibidas = [
        // Estabelecimentos
        'clínica', 'clinica', 'hospital', 'laboratório', 'laboratorio', 
        'farmácia', 'farmacia', 'centro médico', 'centro', 'instituto',
        'unidade', 'rede', 'grupo', 'complexo', 'policlínica', 'posto',
        // Serviços
        'atendimento', 'agendamento', 'consulta', 'consultório em',
        'localiza', 'encontre', 'busca', 'procura', 'diretório',
        // Localizações genéricas
        'em rio', 'em são', 'em belo', 'na zona', 'no bairro',
        'rio de janeiro', 'são paulo', 'belo horizonte',
        // Termos comerciais
        'ltda', 'sa', 's.a.', 'me', 'eireli', 'associação',
        // Outros
        'página', 'site', 'website', 'portal', 'plataforma'
      ];
      
      // Se contém qualquer palavra proibida, rejeitar imediatamente
      const contemProibido = palavrasProibidas.some(palavra => textoLower.includes(palavra));
      if (contemProibido) {
        console.log(`[GENERATE-LEADS-B2C] ❌ Rejeitado (termo proibido): "${title.substring(0, 50)}..."`);
        return null;
      }
      
      // ========== EXTRAÇÃO DE NOME - APENAS PADRÕES CONFIÁVEIS ==========
      let nome = null;
      
      // Padrão 1: Dr./Dra. + Nome Completo
      const drPattern = /(?:Dr\.?|Dra\.?)\s+([A-ZÀ-Ú][a-zà-ú]+\s+[A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/;
      const drMatch = text.match(drPattern);
      if (drMatch) {
        nome = drMatch[1].trim();
      }
      
      // Padrão 2: Nome Completo - Profissão | Especialidade
      if (!nome) {
        const linkedinPattern = /([A-ZÀ-Ú][a-zà-ú]+\s+[A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)\s+-\s+(?:Médico|Médica|Doutor|Doutora)/i;
        const linkedinMatch = text.match(linkedinPattern);
        if (linkedinMatch) {
          nome = linkedinMatch[1].trim();
        }
      }
      
      // Padrão 3: CRM/CRP/OAB + Nome
      if (!nome) {
        const registroPattern = /(?:CRM|CRP|OAB|CREA|CAU)\s+\d+\s*[-:]\s*([A-ZÀ-Ú][a-zà-ú]+\s+[A-ZÀ-Ú][a-zà-ú]+)/i;
        const registroMatch = text.match(registroPattern);
        if (registroMatch) {
          nome = registroMatch[1].trim();
        }
      }
      
      // Se não achou nome por padrões confiáveis, rejeitar
      if (!nome) {
        console.log(`[GENERATE-LEADS-B2C] ❌ Rejeitado (sem nome válido): "${title.substring(0, 50)}..."`);
        return null;
      }
      
      // ========== VALIDAÇÕES FINAIS DO NOME ==========
      const palavrasNome = nome.split(' ');
      
      // Deve ter no mínimo 2 palavras (nome + sobrenome)
      if (palavrasNome.length < 2) {
        console.log(`[GENERATE-LEADS-B2C] ❌ Rejeitado (nome incompleto): "${nome}"`);
        return null;
      }
      
      // Não pode ter mais de 4 palavras (evita títulos longos)
      if (palavrasNome.length > 4) {
        console.log(`[GENERATE-LEADS-B2C] ❌ Rejeitado (nome muito longo): "${nome}"`);
        return null;
      }
      
      // Cada palavra deve começar com maiúscula
      const todasMaiusculas = palavrasNome.every(p => /^[A-ZÀ-Ú]/.test(p));
      if (!todasMaiusculas) {
        console.log(`[GENERATE-LEADS-B2C] ❌ Rejeitado (capitalização inválida): "${nome}"`);
        return null;
      }
      
      // Não pode conter números
      if (/\d/.test(nome)) {
        console.log(`[GENERATE-LEADS-B2C] ❌ Rejeitado (contém números): "${nome}"`);
        return null;
      }
      
      console.log(`[GENERATE-LEADS-B2C] ✅ Nome válido extraído: "${nome}"`);
      
      // ========== EXTRAIR DADOS ADICIONAIS ==========
      
      // Extrair especialidade
      const especialidadePatterns = [
        /(?:especialidade|especialista|especializado)\s+em\s+([a-zà-ú]+(?:\s+[a-zà-ú]+)?)/i,
        /(cardiologi|dermatologi|ortopedi|pediatr|ginecologi|oftalmologi|psiquiatr|neurologis|urologis)[a-z]*/i,
      ];

      let especialidade = null;
      for (const pattern of especialidadePatterns) {
        const match = text.match(pattern);
        if (match) {
          especialidade = match[1] || match[0];
          break;
        }
      }

      // Extrair telefone
      const telefoneMatch = text.match(/(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/);
      const telefone = telefoneMatch ? telefoneMatch[0] : null;

      // Extrair cidade
      const cidadeMatch = text.match(/(?:Rio de Janeiro|RJ|Barra da Tijuca|Copacabana|Ipanema|Leblon|Botafogo)/i);
      const cidade = cidadeMatch ? cidadeMatch[0] : "Rio de Janeiro";

      // Detectar rede social
      let redeSocial = null;
      if (link.includes('linkedin.com')) redeSocial = 'linkedin';
      else if (link.includes('instagram.com')) redeSocial = 'instagram';
      else if (link.includes('facebook.com')) redeSocial = 'facebook';

      return {
        nome,
        especialidade,
        telefone,
        cidade,
        redeSocial,
        link
      };
    };

    let totalEncontrados = 0;
    const leadsCriados = [];

    // Executar no máximo 5 queries para acelerar
    const maxQueries = Math.min(5, queries.length);
    console.log(`[GENERATE-LEADS-B2C] Executando ${maxQueries} queries de ${queries.length} totais`);

    for (const query of queries.slice(0, maxQueries)) {
      console.log(`[GENERATE-LEADS-B2C] Buscando: ${query}`);
      
      try {
        const results = await googleSearch(query);
        
        for (const item of results.items || []) {
          const leadInfo = extractLeadInfo(item.title, item.snippet, item.link);
          
          if (leadInfo && leadInfo.nome) {
            console.log(`[GENERATE-LEADS-B2C] 👤 Lead potencial: ${leadInfo.nome}`);
            
            // Verificar se já existe (por nome E cidade para evitar falsos positivos)
            const { data: existente } = await supabaseClient
              .from('leads_b2c')
              .select('id')
              .eq('nome_completo', leadInfo.nome)
              .eq('cidade', leadInfo.cidade || 'Rio de Janeiro')
              .eq('user_id', campanha.user_id)
              .maybeSingle();

            if (existente) {
              console.log(`[GENERATE-LEADS-B2C] ⏭️ Lead já existe: ${leadInfo.nome} (${leadInfo.cidade})`);
              continue;
            }
              const leadData: any = {
                campanha_id,
                user_id: campanha.user_id,
                nome_completo: leadInfo.nome,
                profissao: b2cConfig.profissoes?.[0] || 'Profissional',
                especialidade: leadInfo.especialidade,
                cidade: leadInfo.cidade,
                estado: 'RJ',
                telefone: leadInfo.telefone,
                fonte: 'google_search',
                fonte_url: leadInfo.link,
                fonte_snippet: item.snippet,
                query_usada: query,
                pipeline_status: 'descoberto'
              };
              
              console.log(`[GENERATE-LEADS-B2C] 💾 Salvando lead: ${leadInfo.nome}`);

              // Adicionar URL da rede social no campo correto
              if (leadInfo.redeSocial === 'linkedin') {
                leadData.linkedin_url = leadInfo.link;
              } else if (leadInfo.redeSocial === 'instagram') {
                leadData.instagram_username = leadInfo.link.split('/').pop();
              } else if (leadInfo.redeSocial === 'facebook') {
                leadData.facebook_url = leadInfo.link;
              }

              const { data: lead } = await supabaseClient
                .from('leads_b2c')
                .insert(leadData)
                .select()
                .single();

              if (lead) {
                leadsCriados.push(lead);
                totalEncontrados++;
                console.log(`[GENERATE-LEADS-B2C] ✅ Lead ${totalEncontrados} criado: ${leadInfo.nome}`);
              }
            
            // Parar se atingir o limite
            if (totalEncontrados >= limite) {
              console.log(`[GENERATE-LEADS-B2C] 🎯 Limite de ${limite} leads atingido!`);
              break;
            }
          } else {
            console.log(`[GENERATE-LEADS-B2C] ❌ Não foi possível extrair info de: ${item.title}`);
          }
        }
        
        // Parar queries se já atingiu o limite
        if (totalEncontrados >= limite) break;

        // Delay menor entre queries (500ms)
        await new Promise(resolve => setTimeout(resolve, 500));
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

  } catch (error: any) {
    console.error("❌ === ERRO FATAL ===");
    console.error("Mensagem:", error.message);
    console.error("Stack:", error.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack
      }),
      { 
        status: 200, // Retornar 200 para não quebrar o frontend
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
