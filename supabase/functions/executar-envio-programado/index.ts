// ============================================
// EXECUTAR ENVIO PROGRAMADO - EDGE FUNCTION
// AMZ Ofertas - Envio Automático para Grupos
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONFIG = {
  WUZAPI_URL: "https://api2.amzofertas.com.br",
  DELAY_ENTRE_GRUPOS_MS: 2000,
  MAX_PROGRAMACOES_POR_EXECUCAO: 5,
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Verifica se a URL é uma imagem válida
function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  
  // Deve conter extensão de imagem ou ser de CDN de imagens conhecida
  const imagePatterns = [
    /\.(jpg|jpeg|png|gif|webp)(\?|$)/i,
    /images-na\.ssl-images-amazon\.com/i,
    /m\.media-amazon\.com\/images/i,
    /mlstatic\.com/i,
    /cloudinary\.com/i,
    /imgur\.com/i
  ];
  
  return imagePatterns.some(pattern => pattern.test(url));
}

// Resolve imagem da Amazon a partir do link do produto
async function resolverImagemAmazon(produtoUrl: string): Promise<string | null> {
  try {
    if (!produtoUrl.includes('amazon.com.br')) return null;
    
    console.log("🔍 Resolvendo imagem da Amazon...");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/resolve-amazon-image`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url: produtoUrl })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.imageUrl && isValidImageUrl(data.imageUrl)) {
        console.log(`✅ Imagem resolvida: ${data.imageUrl.substring(0, 50)}...`);
        return data.imageUrl;
      }
    }
    
    return null;
  } catch (error) {
    console.error("❌ Erro ao resolver imagem:", error);
    return null;
  }
}

// Obtém a melhor URL de imagem disponível
async function obterImagemProduto(produto: any): Promise<string | null> {
  const imagemUrl = produto.imagem_url;
  
  if (!imagemUrl) {
    console.log("⚠️ Produto sem imagem cadastrada");
    return null;
  }
  
  // Se já é uma URL de imagem válida, usar diretamente
  if (isValidImageUrl(imagemUrl)) {
    console.log(`📷 Usando imagem direta: ${imagemUrl.substring(0, 60)}...`);
    return imagemUrl;
  }
  
  // Se é um link de produto Amazon, tentar extrair a imagem
  if (imagemUrl.includes('amazon.com.br')) {
    const imagemResolvida = await resolverImagemAmazon(imagemUrl);
    if (imagemResolvida) {
      return imagemResolvida;
    }
  }
  
  // Fallback: tentar usar o link_afiliado para resolver imagem
  if (produto.link_afiliado && produto.link_afiliado.includes('amazon.com.br')) {
    console.log("🔄 Tentando resolver imagem via link afiliado...");
    const imagemDoLink = await resolverImagemAmazon(produto.link_afiliado);
    if (imagemDoLink) {
      return imagemDoLink;
    }
  }
  
  console.log("⚠️ Não foi possível obter imagem válida");
  return null;
}

// Gera mensagem criativa via IA
async function gerarMensagemIA(produto: any, config: any): Promise<string | null> {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.log("⚠️ LOVABLE_API_KEY não configurada, usando mensagem padrão");
      return null;
    }

    console.log(`🤖 Gerando post criativo com IA para: ${produto.titulo}`);

    const prompt = `Crie UMA mensagem criativa de WhatsApp para vender este produto em grupo de ofertas:

PRODUTO:
- Nome: ${produto.titulo}
- Preço: R$ ${produto.preco?.toFixed(2) || 'Confira'}
- Categoria: ${produto.categoria || 'Geral'}
- Link: ${produto.link_afiliado || ''}

REGRAS:
- Mensagem CURTA (máximo 5 linhas)
- Linguagem informal brasileira ("vc", "pra", "só")
- 2-4 emojis relevantes (🔥💰🛒✨ etc)
- Destaque o preço de forma atrativa
- Crie URGÊNCIA ou BENEFÍCIO único
- Termine com call-to-action
- SEMPRE inclua o link no final
- Seja criativo, CADA mensagem deve ser DIFERENTE

Retorne APENAS a mensagem pronta, sem explicações.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "Você é um copywriter especialista em vendas por WhatsApp. Crie mensagens únicas, criativas e persuasivas. Retorne APENAS a mensagem, nada mais."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.95, // Alta criatividade para variar cada post
        max_tokens: 300
      }),
    });

    if (!response.ok) {
      console.error("❌ Erro na IA:", response.status);
      return null;
    }

    const data = await response.json();
    let mensagem = data.choices?.[0]?.message?.content?.trim();

    if (!mensagem) {
      console.log("⚠️ IA retornou vazio");
      return null;
    }

    // Limpar possíveis marcações
    mensagem = mensagem.replace(/```[\s\S]*?```/g, "").trim();

    // Garantir que o link está incluído
    if (produto.link_afiliado && !mensagem.includes(produto.link_afiliado)) {
      mensagem += `\n\n🛒 ${produto.link_afiliado}`;
    }

    console.log(`✅ Mensagem IA gerada: ${mensagem.substring(0, 80)}...`);
    return mensagem;

  } catch (error) {
    console.error("❌ Erro ao gerar mensagem IA:", error);
    return null;
  }
}

function formatarMensagemProduto(produto: any, config: any): string {
  let msg = "";
  
  if (config.prefixo_mensagem) {
    msg += config.prefixo_mensagem + "\n\n";
  }
  
  msg += `*${produto.titulo}*\n\n`;
  
  if (config.incluir_preco && produto.preco) {
    msg += `💰 *R$ ${produto.preco.toFixed(2)}*\n\n`;
  }
  
  if (config.incluir_link && produto.link_afiliado) {
    msg += `🛒 ${produto.link_afiliado}\n\n`;
  }
  
  if (config.sufixo_mensagem) {
    msg += config.sufixo_mensagem;
  }
  
  return msg.trim();
}

async function enviarParaGrupo(
  token: string,
  groupJid: string,
  message: string,
  imageUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let jid = groupJid;
    if (!jid.includes("@")) {
      jid = jid + "@g.us";
    }

    console.log(`📤 Enviando para grupo: ${jid}`);

    if (imageUrl) {
      const response = await fetch(`${CONFIG.WUZAPI_URL}/chat/send/image`, {
        method: "POST",
        headers: { 
          "Token": token, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          Phone: jid,
          Image: imageUrl,
          Caption: message
        })
      });

      if (!response.ok) {
        console.log("⚠️ Falha imagem, enviando só texto...");
        const textResponse = await fetch(`${CONFIG.WUZAPI_URL}/chat/send/text`, {
          method: "POST",
          headers: { 
            "Token": token, 
            "Content-Type": "application/json" 
          },
          body: JSON.stringify({
            Phone: jid,
            Body: message
          })
        });

        if (!textResponse.ok) {
          const err = await textResponse.text();
          return { success: false, error: err };
        }
      }
    } else {
      const response = await fetch(`${CONFIG.WUZAPI_URL}/chat/send/text`, {
        method: "POST",
        headers: { 
          "Token": token, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          Phone: jid,
          Body: message
        })
      });

      if (!response.ok) {
        const err = await response.text();
        return { success: false, error: err };
      }
    }

    console.log(`✅ Enviado para grupo: ${jid}`);
    return { success: true };

  } catch (error: any) {
    console.error(`❌ Erro ao enviar para grupo:`, error);
    return { success: false, error: error.message };
  }
}

async function processarProgramacao(
  supabase: any,
  programacao: any
): Promise<{ success: boolean; error?: string; enviados?: number }> {
  console.log(`\n📋 ════════════════════════════════════════`);
  console.log(`📋 Processando: ${programacao.nome}`);
  console.log(`📋 Categorias: ${programacao.categorias?.join(", ") || "Todas"}`);
  console.log(`📋 ════════════════════════════════════════`);

  try {
    // 1. VERIFICAR HORÁRIO
    const agora = new Date();
    const horaAtual = agora.toTimeString().slice(0, 5);
    
    if (horaAtual < programacao.horario_inicio || horaAtual > programacao.horario_fim) {
      console.log(`⏰ Fora do horário (${horaAtual}). Permitido: ${programacao.horario_inicio} - ${programacao.horario_fim}`);
      
      const { data: proximoEnvio } = await supabase.rpc("calcular_proximo_envio", { 
        p_programacao_id: programacao.id 
      });
      
      await supabase
        .from("programacao_envio_afiliado")
        .update({ proximo_envio: proximoEnvio })
        .eq("id", programacao.id);
      
      return { success: true, enviados: 0 };
    }

    // 2. VERIFICAR DIA
    const diaSemana = agora.getDay();
    const diaMes = agora.getDate();

    if (programacao.dias_mes && programacao.dias_mes.length > 0) {
      if (!programacao.dias_mes.includes(diaMes)) {
        console.log(`📅 Dia ${diaMes} não está na lista: ${programacao.dias_mes.join(", ")}`);
        
        const { data: proximoEnvio } = await supabase.rpc("calcular_proximo_envio", { 
          p_programacao_id: programacao.id 
        });
        
        await supabase
          .from("programacao_envio_afiliado")
          .update({ proximo_envio: proximoEnvio })
          .eq("id", programacao.id);
        
        return { success: true, enviados: 0 };
      }
    } else if (programacao.dias_semana && programacao.dias_semana.length > 0) {
      if (!programacao.dias_semana.includes(diaSemana)) {
        console.log(`📅 ${['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][diaSemana]} não está permitido`);
        
        const { data: proximoEnvio } = await supabase.rpc("calcular_proximo_envio", { 
          p_programacao_id: programacao.id 
        });
        
        await supabase
          .from("programacao_envio_afiliado")
          .update({ proximo_envio: proximoEnvio })
          .eq("id", programacao.id);
        
        return { success: true, enviados: 0 };
      }
    }

    // 3. BUSCAR PRÓXIMO PRODUTO
    const { data: produtoData, error: produtoError } = await supabase
      .rpc("pegar_proximo_produto_programacao", { 
        p_programacao_id: programacao.id 
      });

    if (produtoError || !produtoData || produtoData.length === 0) {
      console.log("⚠️ Nenhum produto disponível para enviar");
      
      const proximoEnvio = new Date(Date.now() + programacao.intervalo_minutos * 60000);
      await supabase
        .from("programacao_envio_afiliado")
        .update({ proximo_envio: proximoEnvio.toISOString() })
        .eq("id", programacao.id);
      
      return { success: true, enviados: 0 };
    }

    const produto = produtoData[0];
    console.log(`📦 Produto: ${produto.titulo}`);
    console.log(`💰 Preço: R$ ${produto.preco?.toFixed(2) || "N/A"}`);

    // 4. BUSCAR TOKEN WUZAPI DO USUÁRIO
    const { data: clienteData } = await supabase
      .from("clientes_afiliados")
      .select("wuzapi_token, wuzapi_instance_id")
      .eq("user_id", programacao.user_id)
      .single();

    if (!clienteData?.wuzapi_token) {
      throw new Error("Token WuzAPI não encontrado");
    }

    // 5. BUSCAR GRUPOS
    let grupos: any[] = [];
    
    if (programacao.enviar_para_todos_grupos) {
      const { data: gruposData } = await supabase
        .from("whatsapp_grupos_afiliado")
        .select("id, group_jid, group_name")
        .eq("user_id", programacao.user_id)
        .eq("ativo", true);
      
      grupos = gruposData || [];
    } else if (programacao.grupos_ids?.length > 0) {
      const { data: gruposData } = await supabase
        .from("whatsapp_grupos_afiliado")
        .select("id, group_jid, group_name")
        .in("id", programacao.grupos_ids)
        .eq("ativo", true);
      
      grupos = gruposData || [];
    }

    if (grupos.length === 0) {
      console.log("⚠️ Nenhum grupo configurado");
      
      const proximoEnvio = new Date(Date.now() + programacao.intervalo_minutos * 60000);
      await supabase
        .from("programacao_envio_afiliado")
        .update({ proximo_envio: proximoEnvio.toISOString() })
        .eq("id", programacao.id);
      
      return { success: true, enviados: 0 };
    }

    console.log(`📱 Grupos para enviar: ${grupos.length}`);

    // 6. GERAR MENSAGEM CRIATIVA COM IA (ou fallback para template)
    let mensagem: string;
    
    // Tentar gerar via IA primeiro (posts únicos e criativos)
    const mensagemIA = await gerarMensagemIA(produto, programacao);
    
    if (mensagemIA) {
      mensagem = mensagemIA;
      console.log("🤖 Usando mensagem gerada pela IA");
    } else {
      // Fallback: usar template padrão
      mensagem = formatarMensagemProduto(produto, programacao);
      console.log("📝 Usando mensagem template padrão");
    }
    
    // Obter imagem válida (resolve automaticamente links da Amazon)
    let imagemUrl: string | undefined = undefined;
    if (programacao.incluir_imagem) {
      const img = await obterImagemProduto(produto);
      if (img) imagemUrl = img;
    }

    // 7. ENVIAR PARA CADA GRUPO (com deduplicação)
    let gruposEnviados = 0;
    const gruposIdsEnviados: string[] = [];

    for (const grupo of grupos) {
      // ✅ DEDUPLICAÇÃO: verificar se já enviamos para este grupo nos últimos 2 minutos
      const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
      const { data: recentEnvio } = await supabase
        .from("historico_envios")
        .select("timestamp")
        .eq("whatsapp", grupo.group_jid)
        .eq("tipo", "grupo")
        .gte("timestamp", twoMinutesAgo)
        .limit(1);
      
      if (recentEnvio && recentEnvio.length > 0) {
        console.log(`⏭️ Grupo ${grupo.group_name} já recebeu mensagem nos últimos 2min, pulando...`);
        continue;
      }
      
      // ✅ REGISTRAR ANTES de enviar (evita race condition)
      await supabase.from("historico_envios").insert({
        whatsapp: grupo.group_jid,
        tipo: "grupo",
        mensagem: mensagem.substring(0, 200),
        sucesso: true,
        timestamp: new Date().toISOString()
      });
      
      const resultado = await enviarParaGrupo(
        clienteData.wuzapi_token,
        grupo.group_jid,
        mensagem,
        imagemUrl
      );

      if (resultado.success) {
        gruposEnviados++;
        gruposIdsEnviados.push(grupo.id);
      } else {
        // Se falhou, atualizar registro para sucesso=false
        await supabase
          .from("historico_envios")
          .update({ sucesso: false, erro: resultado.error })
          .eq("whatsapp", grupo.group_jid)
          .eq("tipo", "grupo")
          .order("timestamp", { ascending: false })
          .limit(1);
      }

      await sleep(CONFIG.DELAY_ENTRE_GRUPOS_MS);
    }

    console.log(`✅ Enviado para ${gruposEnviados}/${grupos.length} grupos`);

    // 8. REGISTRAR PRODUTO COMO ENVIADO
    await supabase
      .from("produtos_enviados_programacao")
      .upsert({
        programacao_id: programacao.id,
        produto_id: produto.produto_id,
        enviado_at: new Date().toISOString()
      }, { onConflict: "programacao_id,produto_id" });

    // 9. REGISTRAR NO HISTÓRICO
    await supabase
      .from("historico_envio_programado")
      .insert({
        programacao_id: programacao.id,
        user_id: programacao.user_id,
        produto_id: produto.produto_id,
        produto_titulo: produto.titulo,
        produto_preco: produto.preco,
        produto_categoria: produto.categoria,
        produto_link: produto.link_afiliado,
        produto_imagem: produto.imagem_url,
        grupos_enviados: gruposEnviados,
        grupos_ids: gruposIdsEnviados,
        sucesso: gruposEnviados > 0
      });

    // 10. ATUALIZAR PROGRAMAÇÃO
    const proximoEnvio = new Date(Date.now() + programacao.intervalo_minutos * 60000);
    const hoje = new Date().toISOString().slice(0, 10);
    const resetDiario = programacao.ultimo_reset_diario !== hoje;
    
    await supabase
      .from("programacao_envio_afiliado")
      .update({
        proximo_envio: proximoEnvio.toISOString(),
        ultimo_envio: new Date().toISOString(),
        ultimo_produto_id: produto.produto_id,
        total_enviados: (programacao.total_enviados || 0) + 1,
        total_enviados_hoje: resetDiario ? 1 : (programacao.total_enviados_hoje || 0) + 1,
        ultimo_reset_diario: hoje
      })
      .eq("id", programacao.id);

    console.log(`📅 Próximo envio: ${proximoEnvio.toLocaleString("pt-BR")}`);

    return { success: true, enviados: gruposEnviados };

  } catch (error: any) {
    console.error(`❌ Erro ao processar programação:`, error);
    
    const proximoEnvio = new Date(Date.now() + programacao.intervalo_minutos * 60000);
    await supabase
      .from("programacao_envio_afiliado")
      .update({ proximo_envio: proximoEnvio.toISOString() })
      .eq("id", programacao.id);
    
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("\n🚀 ════════════════════════════════════════");
    console.log("🚀 EXECUTANDO ENVIOS PROGRAMADOS");
    console.log(`🚀 ${new Date().toLocaleString("pt-BR")}`);
    console.log("🚀 ════════════════════════════════════════\n");

    const body = await req.json().catch(() => ({}));
    const userId = body.userId || null;
    const programacaoId = body.programacaoId || null;

    // BUSCAR PROGRAMAÇÕES PENDENTES
    let query = supabase
      .from("programacao_envio_afiliado")
      .select("*")
      .eq("ativo", true)
      .or("proximo_envio.is.null,proximo_envio.lte.now()")
      .order("proximo_envio", { ascending: true, nullsFirst: true })
      .limit(CONFIG.MAX_PROGRAMACOES_POR_EXECUCAO);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    if (programacaoId) {
      query = query.eq("id", programacaoId);
    }

    const { data: programacoes, error: queryError } = await query;

    if (queryError) {
      throw queryError;
    }

    if (!programacoes || programacoes.length === 0) {
      console.log("📭 Nenhuma programação pendente");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhuma programação pendente",
          processed: 0,
          duration_ms: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📋 ${programacoes.length} programações para processar`);

    let totalProcessadas = 0;
    let totalEnviados = 0;
    let erros = 0;

    for (const prog of programacoes) {
      const resultado = await processarProgramacao(supabase, prog);
      
      totalProcessadas++;
      
      if (resultado.success) {
        totalEnviados += resultado.enviados || 0;
      } else {
        erros++;
      }

      await sleep(1000);
    }

    const duracao = Date.now() - startTime;

    console.log("\n🚀 ════════════════════════════════════════");
    console.log(`✅ Processamento concluído!`);
    console.log(`   📋 Programações: ${totalProcessadas}`);
    console.log(`   📤 Grupos enviados: ${totalEnviados}`);
    console.log(`   ❌ Erros: ${erros}`);
    console.log(`   ⏱️ Duração: ${duracao}ms`);
    console.log("🚀 ════════════════════════════════════════\n");

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: totalProcessadas,
        sent: totalEnviados,
        errors: erros,
        duration_ms: duracao
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("💥 Erro geral:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        duration_ms: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
