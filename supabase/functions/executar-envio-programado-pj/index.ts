// ============================================
// EXECUTAR ENVIO PROGRAMADO PJ - EDGE FUNCTION
// AMZ Ofertas - Sistema PJ (Locaweb)
// Tecnologia avançada baseada nos Afiliados
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PJ usa Locaweb
const LOCAWEB_WUZAPI_URL = Deno.env.get("WUZAPI_URL") || "https://wuzapi.amzofertas.com.br";
const LOCAWEB_WUZAPI_TOKEN = Deno.env.get("WUZAPI_TOKEN") || "";

// ═══════════════════════════════════════
// 🔧 CONFIGURAÇÕES ANTI-BLOQUEIO
// ═══════════════════════════════════════
const CONFIG = {
  DELAY_ENTRE_ENVIOS_MS: 5000, // 5 segundos entre envios
  MAX_IMAGE_SIZE_KB: 500,      // Limite de imagem
};

// ═══════════════════════════════════════
// 🔧 FUNÇÕES AUXILIARES
// ═══════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Gerar variação de mensagem usando IA (humaniza)
async function gerarVariacaoMensagem(mensagemBase: string): Promise<string> {
  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.log("⚠️ [PJ-SCHEDULER] GEMINI_API_KEY não configurada, usando mensagem original");
      return mensagemBase;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Reescreva esta mensagem promocional de forma LEVEMENTE diferente, mantendo TODAS as informações (título, preço, link). Mude apenas saudação, emojis e estrutura das frases. Mantenha curta e direta. NÃO adicione informações novas. Retorne APENAS a mensagem reescrita:\n\n${mensagemBase}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          }
        })
      }
    );

    if (!response.ok) {
      console.log("⚠️ [PJ-SCHEDULER] Erro na IA, usando mensagem original");
      return mensagemBase;
    }

    const data = await response.json();
    const variacao = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (variacao && variacao.length > 20) {
      console.log("✨ [PJ-SCHEDULER] Variação de mensagem gerada com sucesso");
      return variacao;
    }

    return mensagemBase;
  } catch (error) {
    console.error("❌ [PJ-SCHEDULER] Erro ao gerar variação:", error);
    return mensagemBase;
  }
}

// Enviar mensagem para grupo
async function enviarParaGrupo(
  wuzapiToken: string,
  grupoJid: string,
  mensagem: string,
  imagemUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`📱 [PJ-SCHEDULER] Enviando para grupo ${grupoJid}...`);

    let response: Response;
    let payload: any;

    if (imagemUrl) {
      // Tentar enviar com imagem
      response = await fetch(`${LOCAWEB_WUZAPI_URL}/chat/send/image`, {
        method: "POST",
        headers: {
          "Token": wuzapiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Phone: grupoJid,
          Caption: mensagem,
          Image: imagemUrl,
        }),
      });

      payload = await response.json();

      // Fallback se imagem falhar
      if (!response.ok || payload?.success === false) {
        const errMsg = payload?.error || payload?.message || "";
        const isMediaError =
          errMsg.toLowerCase().includes("upload") ||
          errMsg.toLowerCase().includes("media") ||
          errMsg.toLowerCase().includes("websocket") ||
          errMsg.toLowerCase().includes("timed out");

        if (isMediaError || !response.ok) {
          console.log("🧯 [PJ-SCHEDULER] Fallback para texto...");
          
          response = await fetch(`${LOCAWEB_WUZAPI_URL}/chat/send/text`, {
            method: "POST",
            headers: {
              "Token": wuzapiToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              Phone: grupoJid,
              Body: mensagem,
            }),
          });

          payload = await response.json();
        }
      }
    } else {
      // Enviar só texto
      response = await fetch(`${LOCAWEB_WUZAPI_URL}/chat/send/text`, {
        method: "POST",
        headers: {
          "Token": wuzapiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Phone: grupoJid,
          Body: mensagem,
        }),
      });

      payload = await response.json();
    }

    const success = response.ok && payload?.success !== false;

    if (success) {
      console.log(`✅ [PJ-SCHEDULER] Enviado para ${grupoJid}`);
    } else {
      console.error(`❌ [PJ-SCHEDULER] Falha para ${grupoJid}:`, payload);
    }

    return { success, error: success ? undefined : (payload?.error || "Erro desconhecido") };

  } catch (error: any) {
    console.error(`❌ [PJ-SCHEDULER] Erro ao enviar:`, error);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════
// 🚀 HANDLER PRINCIPAL
// ═══════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("⏰ [PJ-SCHEDULER] Iniciando verificação de envios programados...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const agora = new Date();
    const horaAtual = agora.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    const diaSemana = agora.getDay();

    console.log(`📅 [PJ-SCHEDULER] Hora: ${horaAtual}, Dia: ${diaSemana}`);

    // ═══════════════════════════════════════
    // BUSCAR DE AMBAS AS TABELAS
    // ═══════════════════════════════════════
    
    // 1. Buscar de pj_envios_programados (sistema de intervalos)
    const { data: programacoesEnvio, error: fetchError1 } = await supabase
      .from("pj_envios_programados")
      .select("*")
      .eq("ativo", true)
      .eq("pausado", false)
      .lte("proximo_envio", agora.toISOString());

    if (fetchError1) {
      console.error("❌ [PJ-SCHEDULER] Erro ao buscar pj_envios_programados:", fetchError1);
    }

    // 2. Buscar de campanhas_recorrentes (sistema de horários/dias - área de produtos)
    const { data: campanhasRecorrentes, error: fetchError2 } = await supabase
      .from("campanhas_recorrentes")
      .select("*")
      .eq("ativa", true)
      .contains("dias_semana", [diaSemana]);

    if (fetchError2) {
      console.error("❌ [PJ-SCHEDULER] Erro ao buscar campanhas_recorrentes:", fetchError2);
    }

    // Filtrar campanhas_recorrentes que têm horário agora
    const campanhasParaExecutar = (campanhasRecorrentes || []).filter((camp: any) => {
      if (!camp.horarios || camp.horarios.length === 0) return false;
      
      // Verificar se algum horário bate com a hora atual (com margem de 2 minutos)
      const horaAtualMinutos = parseInt(horaAtual.split(":")[0]) * 60 + parseInt(horaAtual.split(":")[1]);
      
      return camp.horarios.some((horario: string) => {
        const [h, m] = horario.split(":").map(Number);
        const horarioMinutos = h * 60 + m;
        const diff = Math.abs(horaAtualMinutos - horarioMinutos);
        return diff <= 2; // Margem de 2 minutos
      });
    });

    console.log(`📋 [PJ-SCHEDULER] Encontradas: ${programacoesEnvio?.length || 0} envios programados, ${campanhasParaExecutar.length} campanhas recorrentes`);

    // Combinar ambas as fontes
    const programacoes = programacoesEnvio || [];
    const campanhas = campanhasParaExecutar || [];

    if (programacoes.length === 0 && campanhas.length === 0) {
      console.log("✅ [PJ-SCHEDULER] Nenhuma programação para executar agora");
      return new Response(
        JSON.stringify({ success: true, executadas: 0, fonte: "ambas" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📬 [PJ-SCHEDULER] ${programacoes.length} programações para executar`);

    let executadas = 0;
    let erros = 0;

    for (const prog of programacoes) {
      try {
        console.log(`🔄 [PJ-SCHEDULER] Processando programação ${prog.id} para grupo ${prog.grupo_nome}...`);

        // Verificar horário permitido
        const horaAtualNum = parseInt(horaAtual.replace(":", ""));
        const horaInicioNum = parseInt(prog.horario_inicio?.replace(":", "") || "0800");
        const horaFimNum = parseInt(prog.horario_fim?.replace(":", "") || "2200");

        if (horaAtualNum < horaInicioNum || horaAtualNum > horaFimNum) {
          console.log(`⏰ [PJ-SCHEDULER] Fora do horário permitido (${prog.horario_inicio} - ${prog.horario_fim})`);
          // Atualizar próximo envio para o próximo dia
          const proximoEnvio = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
          await supabase
            .from("pj_envios_programados")
            .update({ proximo_envio: proximoEnvio.toISOString() })
            .eq("id", prog.id);
          continue;
        }

        // Verificar dia da semana
        if (prog.dias_ativos && !prog.dias_ativos.includes(diaSemana)) {
          console.log(`📅 [PJ-SCHEDULER] Dia ${diaSemana} não está ativo`);
          continue;
        }

        // Buscar produto para enviar
        const { data: produtos, error: prodError } = await supabase
          .from("produtos")
          .select("*")
          .eq("user_id", prog.user_id)
          .neq("id", prog.ultimo_produto_id || "00000000-0000-0000-0000-000000000000")
          .order("created_at", { ascending: false })
          .limit(10);

        if (prodError || !produtos || produtos.length === 0) {
          console.log("⚠️ [PJ-SCHEDULER] Nenhum produto encontrado");
          continue;
        }

        // Filtrar por categorias se definido
        let produtosFiltrados = produtos;
        if (prog.categorias && prog.categorias.length > 0) {
          produtosFiltrados = produtos.filter((p: any) =>
            prog.categorias.some((cat: string) =>
              p.categoria?.toLowerCase().includes(cat.toLowerCase())
            )
          );
        }

        if (produtosFiltrados.length === 0) {
          produtosFiltrados = produtos; // Fallback para todos
        }

        // Selecionar produto (rotativo ou aleatório)
        const produto = produtosFiltrados[Math.floor(Math.random() * produtosFiltrados.length)];

        console.log(`📦 [PJ-SCHEDULER] Produto selecionado: ${produto.titulo?.substring(0, 40)}...`);

        // Buscar token do usuário
        let wuzapiToken = LOCAWEB_WUZAPI_TOKEN;
        const { data: config } = await supabase
          .from("pj_clientes_config")
          .select("wuzapi_token")
          .eq("user_id", prog.user_id)
          .maybeSingle();

        if (config?.wuzapi_token) {
          wuzapiToken = config.wuzapi_token;
        }

        // Montar mensagem base
        const preco = produto.preco ? `R$ ${Number(produto.preco).toFixed(2)}` : "";
        let mensagemBase = `🔥 *${produto.titulo}*\n\n`;
        if (preco) mensagemBase += `💰 *${preco}*\n\n`;
        mensagemBase += `🛒 *Compre aqui:* ${produto.link_afiliado || produto.url || ""}`;

        // Gerar variação de mensagem (anti-bloqueio via IA)
        const mensagem = await gerarVariacaoMensagem(mensagemBase);

        // Enviar para o grupo
        const resultado = await enviarParaGrupo(
          wuzapiToken,
          prog.grupo_jid,
          mensagem,
          produto.imagem_url || produto.imagem
        );

        if (resultado.success) {
          console.log(`✅ [PJ-SCHEDULER] Enviado para ${prog.grupo_nome}`);

          // Calcular próximo envio
          const proximoEnvio = new Date(agora.getTime() + prog.intervalo_minutos * 60 * 1000);

          // Atualizar programação
          await supabase
            .from("pj_envios_programados")
            .update({
              ultimo_envio: agora.toISOString(),
              proximo_envio: proximoEnvio.toISOString(),
              ultimo_produto_id: produto.id,
              total_enviados: (prog.total_enviados || 0) + 1,
            })
            .eq("id", prog.id);

          // Registrar no histórico
          await supabase.from("pj_historico_envios").insert({
            user_id: prog.user_id,
            programacao_id: prog.id,
            grupo_jid: prog.grupo_jid,
            grupo_nome: prog.grupo_nome,
            produto_id: produto.id,
            produto_titulo: produto.titulo,
            mensagem,
            imagem_url: produto.imagem_url || produto.imagem,
            status: "enviado",
            enviado_em: new Date().toISOString(),
          });

          executadas++;
        } else {
          console.error(`❌ [PJ-SCHEDULER] Falha para ${prog.grupo_nome}:`, resultado.error);

          // Registrar erro
          await supabase.from("pj_historico_envios").insert({
            user_id: prog.user_id,
            programacao_id: prog.id,
            grupo_jid: prog.grupo_jid,
            grupo_nome: prog.grupo_nome,
            produto_id: produto.id,
            produto_titulo: produto.titulo,
            status: "erro",
            erro: resultado.error || "Erro desconhecido",
            enviado_em: new Date().toISOString(),
          });

          erros++;
        }

        // Delay anti-bloqueio entre envios
        await sleep(CONFIG.DELAY_ENTRE_ENVIOS_MS);

      } catch (progError: any) {
        console.error(`❌ [PJ-SCHEDULER] Erro na programação ${prog.id}:`, progError);
        erros++;
      }
    }

    // ═══════════════════════════════════════
    // PROCESSAR CAMPANHAS_RECORRENTES (área de produtos)
    // ═══════════════════════════════════════
    for (const camp of campanhas) {
      try {
        console.log(`🔄 [PJ-SCHEDULER] Processando campanha recorrente: ${camp.nome}...`);

        // Verificar se já foi executada neste horário (evitar duplicata)
        if (camp.ultima_execucao) {
          const ultimaExec = new Date(camp.ultima_execucao);
          const diffMinutos = (agora.getTime() - ultimaExec.getTime()) / (1000 * 60);
          if (diffMinutos < 5) {
            console.log(`⏭️ [PJ-SCHEDULER] Campanha ${camp.nome} já executada há ${diffMinutos.toFixed(0)} minutos`);
            continue;
          }
        }

        // Buscar destinos: pj_grupos_ids ou listas_ids
        let destinosJids: string[] = [];
        
        if (camp.pj_grupos_ids && camp.pj_grupos_ids.length > 0) {
          destinosJids = camp.pj_grupos_ids;
        } else if (camp.listas_ids && camp.listas_ids.length > 0) {
          // Buscar grupos das listas
          const { data: grupos } = await supabase
            .from("pj_grupos_whatsapp")
            .select("grupo_jid")
            .eq("user_id", camp.user_id)
            .eq("ativo", true);
          
          if (grupos && grupos.length > 0) {
            destinosJids = grupos.map((g: any) => g.grupo_jid);
          }
        }

        if (destinosJids.length === 0) {
          console.log(`⚠️ [PJ-SCHEDULER] Campanha ${camp.nome} sem destinos configurados`);
          continue;
        }

        // Buscar produto (usar produtos_ids ou buscar do user)
        let produto: any = null;
        
        if (camp.produtos_ids && camp.produtos_ids.length > 0) {
          const idx = camp.ultimo_produto_index || 0;
          const produtoId = camp.produtos_ids[idx % camp.produtos_ids.length];
          
          const { data: prod } = await supabase
            .from("produtos")
            .select("*")
            .eq("id", produtoId)
            .maybeSingle();
          
          produto = prod;
        } else {
          // Buscar qualquer produto do usuário
          const { data: prods } = await supabase
            .from("produtos")
            .select("*")
            .eq("user_id", camp.user_id)
            .order("created_at", { ascending: false })
            .limit(1);
          
          if (prods && prods.length > 0) {
            produto = prods[0];
          }
        }

        if (!produto) {
          console.log(`⚠️ [PJ-SCHEDULER] Campanha ${camp.nome} sem produto encontrado`);
          continue;
        }

        console.log(`📦 [PJ-SCHEDULER] Produto: ${produto.titulo?.substring(0, 40)}...`);

        // Buscar token do usuário
        let wuzapiToken = LOCAWEB_WUZAPI_TOKEN;
        const { data: config } = await supabase
          .from("pj_clientes_config")
          .select("wuzapi_token")
          .eq("user_id", camp.user_id)
          .maybeSingle();

        if (config?.wuzapi_token) {
          wuzapiToken = config.wuzapi_token;
        }

        // Montar mensagem
        const preco = produto.preco ? `R$ ${Number(produto.preco).toFixed(2)}` : "";
        let mensagemBase = camp.mensagem_template || `🔥 *${produto.titulo}*\n\n`;
        
        // Substituir variáveis
        mensagemBase = mensagemBase
          .replace("{{produto}}", produto.titulo || "")
          .replace("{{preco}}", preco)
          .replace("{{link}}", produto.link_afiliado || produto.url || "");
        
        if (!mensagemBase.includes(produto.titulo)) {
          mensagemBase = `🔥 *${produto.titulo}*\n\n`;
          if (preco) mensagemBase += `💰 *${preco}*\n\n`;
          mensagemBase += `🛒 *Compre aqui:* ${produto.link_afiliado || produto.url || ""}`;
        }

        // Gerar variação de mensagem
        const mensagem = await gerarVariacaoMensagem(mensagemBase);

        // Enviar para cada destino
        let sucessosCampanha = 0;
        for (const jid of destinosJids) {
          const resultado = await enviarParaGrupo(
            wuzapiToken,
            jid,
            mensagem,
            produto.imagem_url || produto.imagem
          );

          if (resultado.success) {
            sucessosCampanha++;
            executadas++;
          } else {
            erros++;
          }

          await sleep(CONFIG.DELAY_ENTRE_ENVIOS_MS);
        }

        console.log(`✅ [PJ-SCHEDULER] Campanha ${camp.nome}: ${sucessosCampanha}/${destinosJids.length} enviados`);

        // Atualizar campanha
        const novoIndex = ((camp.ultimo_produto_index || 0) + 1) % (camp.produtos_ids?.length || 1);
        
        await supabase
          .from("campanhas_recorrentes")
          .update({
            ultima_execucao: agora.toISOString(),
            ultimo_produto_index: novoIndex,
            total_enviados: (camp.total_enviados || 0) + sucessosCampanha,
          })
          .eq("id", camp.id);

      } catch (campError: any) {
        console.error(`❌ [PJ-SCHEDULER] Erro na campanha ${camp.id}:`, campError);
        erros++;
      }
    }

    console.log(`📊 [PJ-SCHEDULER] Resultado final: ${executadas} executadas, ${erros} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        executadas,
        erros,
        total: programacoes.length + campanhas.length,
        fonte: "ambas_tabelas",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ [PJ-SCHEDULER] Erro geral:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
