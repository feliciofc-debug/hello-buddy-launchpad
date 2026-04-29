// ============================================
// PROCESSAR FILA DE ATENDIMENTO PJ - EDGE FUNCTION
// AMZ Ofertas - Sistema Anti-Bloqueio WhatsApp PJ
// Tecnologia avançada dos Afiliados, usando Locaweb
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════
// 🔧 CONFIGURAÇÕES ANTI-BLOQUEIO HUMANIZADO
// ═══════════════════════════════════════
const CONFIG = {
  // Delays entre mensagens (mais humano)
  DELAY_MIN_MS: 3000,           // 3 segundos mínimo entre msgs
  DELAY_MAX_MS: 8000,           // 8 segundos máximo entre msgs
  
  // Tempo de "digitando" visível pro cliente
  TEMPO_TYPING_MIN_MS: 1500,    // Mínimo 1.5s "digitando"
  TEMPO_TYPING_MAX_MS: 4000,    // Máximo 4s "digitando"
  TEMPO_TYPING_POR_CHAR_MS: 20, // +20ms por caractere
  
  // Processamento
  BATCH_SIZE: 5,
  MAX_TENTATIVAS: 3,
  
  // PJ usa Locaweb
  WUZAPI_URL: Deno.env.get("WUZAPI_URL") || "https://wuzapi.amzofertas.com.br",
};

const LOCAWEB_WUZAPI_TOKEN = Deno.env.get("WUZAPI_TOKEN") || "";

// ═══════════════════════════════════════
// 🔧 FUNÇÕES AUXILIARES
// ═══════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isGrupoJid(destino: string): boolean {
  return (destino || '').includes('@g.us');
}

function formatarDestinoWhatsApp(destino: string): string {
  const destinoLimpo = (destino || '').trim();

  if (isGrupoJid(destinoLimpo)) {
    return destinoLimpo;
  }

  let formattedPhone = destinoLimpo.replace(/\D/g, "");
  if (!formattedPhone.startsWith("55") && formattedPhone.length === 11) {
    formattedPhone = "55" + formattedPhone;
  }

  return formattedPhone;
}

function calcularTempoDigitacao(mensagem: string): number {
  const tamanho = mensagem?.length || 0;
  const base = CONFIG.TEMPO_TYPING_MIN_MS + 
    Math.random() * (CONFIG.TEMPO_TYPING_MAX_MS - CONFIG.TEMPO_TYPING_MIN_MS);
  const porCaractere = Math.min(tamanho * CONFIG.TEMPO_TYPING_POR_CHAR_MS, 5000);
  return Math.min(base + porCaractere, 8000);
}

function calcularDelayAleatorio(): number {
  return CONFIG.DELAY_MIN_MS + 
    Math.random() * (CONFIG.DELAY_MAX_MS - CONFIG.DELAY_MIN_MS);
}

async function buscarInstanciaConectada(supabase: any, userId: string, targetPort?: number | null) {
  const { data: instances, error } = await supabase
    .from("wuzapi_instances")
    .select("wuzapi_url, wuzapi_token, port, is_connected, updated_at, connected_at")
    .eq("assigned_to_user", userId)
    .order("is_connected", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("❌ [PJ-FILA] Erro ao buscar instâncias:", error);
    return null;
  }

  const lista = instances || [];
  const portaConectada = targetPort
    ? lista.find((inst: any) => Number(inst.port) === Number(targetPort) && inst.is_connected === true)
    : null;
  const qualquerConectada = lista.find((inst: any) => inst.is_connected === true);
  const portaConfigurada = targetPort
    ? lista.find((inst: any) => Number(inst.port) === Number(targetPort))
    : null;

  if (targetPort && portaConfigurada && portaConfigurada.is_connected !== true && qualquerConectada) {
    console.warn(`⚠️ [PJ-FILA] Porta configurada ${targetPort} desconectada; usando porta conectada ${qualquerConectada.port}`);
  }

  return portaConectada || qualquerConectada || portaConfigurada || null;
}

// ═══════════════════════════════════════
// 📤 ENVIAR STATUS "DIGITANDO"
// ═══════════════════════════════════════
async function enviarStatusDigitando(
  wuzapiUrl: string,
  token: string, 
  phone: string
): Promise<boolean> {
  try {
    const formattedPhone = formatarDestinoWhatsApp(phone);

    const baseUrl = wuzapiUrl.endsWith('/') ? wuzapiUrl.slice(0, -1) : wuzapiUrl;

    const response = await fetch(`${baseUrl}/chat/presence`, {
      method: "POST",
      headers: { 
        "Token": token, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        Phone: formattedPhone, 
        State: "composing" 
      })
    });

    if (response.ok) {
      console.log(`⌨️ [PJ-FILA] Status "digitando" enviado para ${formattedPhone}`);
      return true;
    }
    
    // Tentar endpoint alternativo
    const response2 = await fetch(`${baseUrl}/chat/markcomposing`, {
      method: "POST",
      headers: { 
        "Token": token, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ Phone: formattedPhone })
    });

    return response2.ok;
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.log("⚠️ [PJ-FILA] Não foi possível enviar status digitando:", errorMsg);
    return false;
  }
}

// ═══════════════════════════════════════
// 📤 ENVIAR MENSAGEM COM FALLBACK
// ═══════════════════════════════════════
async function enviarMensagem(
  wuzapiUrl: string,
  token: string,
  phone: string,
  message: string,
  imageUrl?: string,
  audioBase64?: string,
  tipoMensagem?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedPhone = formatarDestinoWhatsApp(phone);

    const baseUrl = wuzapiUrl.endsWith('/') ? wuzapiUrl.slice(0, -1) : wuzapiUrl;
    
    console.log(`📤 [PJ-FILA] Enviando para ${formattedPhone} (tipo: ${tipoMensagem || 'texto'})...`);

    // ═══════════════════════════════════════
    // 🔊 ENVIAR ÁUDIO (TTS)
    // ═══════════════════════════════════════
    if (tipoMensagem === 'audio' && audioBase64) {
      console.log(`🔊 [PJ-FILA] Enviando áudio para ${formattedPhone}...`);
      
      const response = await fetch(`${baseUrl}/chat/send/audio`, {
        method: "POST",
        headers: { 
          "Token": token, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          Phone: formattedPhone,
          Audio: audioBase64,
          // Formato base64 MP3
        })
      });

      const responseText = await response.text();

      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          if (data.success !== false && !data.error) {
            console.log(`✅ [PJ-FILA] Áudio enviado para ${formattedPhone}`);
            return { success: true };
          }
        } catch {
          // HTTP OK = sucesso
          console.log(`✅ [PJ-FILA] Áudio enviado para ${formattedPhone}`);
          return { success: true };
        }
      }

      // Fallback: tentar endpoint alternativo de documento/mídia
      console.log("🧯 [PJ-FILA] Tentando endpoint alternativo para áudio...");
      const response2 = await fetch(`${baseUrl}/chat/send/document`, {
        method: "POST",
        headers: { 
          "Token": token, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          Phone: formattedPhone,
          Document: audioBase64,
          FileName: "audio.mp3",
          Mimetype: "audio/mpeg"
        })
      });

      if (response2.ok) {
        console.log(`✅ [PJ-FILA] Áudio enviado como documento para ${formattedPhone}`);
        return { success: true };
      }

      console.error(`❌ [PJ-FILA] Falha ao enviar áudio:`, responseText);
      return { success: false, error: `Erro ao enviar áudio: ${responseText}` };
    }

    // ═══════════════════════════════════════
    // 📷 ENVIAR IMAGEM
    // ═══════════════════════════════════════
    if (imageUrl) {
      const response = await fetch(`${baseUrl}/chat/send/image`, {
        method: "POST",
        headers: { 
          "Token": token, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          Phone: formattedPhone,
          Image: imageUrl,
          Caption: message
        })
      });

      const responseText = await response.text();

      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          if (data.success !== false && !data.error) {
            console.log(`✅ [PJ-FILA] Mensagem com imagem enviada para ${formattedPhone}`);
            return { success: true };
          }
        } catch {
          // HTTP OK = sucesso
          console.log(`✅ [PJ-FILA] Mensagem com imagem enviada para ${formattedPhone}`);
          return { success: true };
        }
      }

      // Se imagem falhou, tentar só texto (fallback)
      console.log("🧯 [PJ-FILA] Imagem falhou, tentando fallback para texto...");
    }

    // ═══════════════════════════════════════
    // 💬 ENVIAR TEXTO
    // ═══════════════════════════════════════
    const textResponse = await fetch(`${baseUrl}/chat/send/text`, {
      method: "POST",
      headers: { 
        "Token": token, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        Phone: formattedPhone,
        Body: message
      })
    });

    const textResponseText = await textResponse.text();

    if (!textResponse.ok) {
      console.error(`❌ [PJ-FILA] Erro HTTP ${textResponse.status}:`, textResponseText);
      return { success: false, error: `HTTP ${textResponse.status}: ${textResponseText}` };
    }

    try {
      const data = JSON.parse(textResponseText);
      if (data.success === false || data.error) {
        return { success: false, error: data.error || "Erro desconhecido" };
      }
    } catch {
      // Resposta não é JSON, mas HTTP OK = sucesso
    }

    console.log(`✅ [PJ-FILA] Mensagem enviada para ${formattedPhone}`);
    return { success: true };

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ [PJ-FILA] Erro ao enviar:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

// ═══════════════════════════════════════
// 🔄 PROCESSAR ITEM DA FILA
// ═══════════════════════════════════════
async function processarItem(
  supabase: any,
  item: any,
  wuzapiUrl: string,
  overrideWuzapiToken?: string | null
): Promise<{ success: boolean; error?: string; tempoTotal?: number }> {
  const startTime = Date.now();

  try {
    console.log(`\n📋 [PJ-FILA] Processando item ${item.id.slice(0, 8)}...`);
    console.log(`   📱 Lead: ${item.lead_phone || item.phone}`);
    console.log(`   👤 Nome: ${item.lead_name || "Desconhecido"}`);

    const phone = item.lead_phone || item.phone;
    const mensagem = item.mensagem;
    const tipoMensagem = item.tipo_mensagem || 'texto';
    const audioBase64 = item.audio_base64;
    const destinoEhGrupo = isGrupoJid(phone);

    // Áudio não precisa de mensagem obrigatória
    if (!mensagem && tipoMensagem !== 'audio') {
      throw new Error("Mensagem não encontrada");
    }

    // Buscar token do usuário (prioridade: token da instância mapeada > token do item > config do usuário > token padrão)
    let wuzapiToken = overrideWuzapiToken || item.wuzapi_token || LOCAWEB_WUZAPI_TOKEN;
    
    if (!wuzapiToken && item.user_id) {
      const { data: config } = await supabase
        .from("pj_clientes_config")
        .select("wuzapi_token")
        .eq("user_id", item.user_id)
        .maybeSingle();

      if (config?.wuzapi_token) {
        wuzapiToken = config.wuzapi_token;
      }
    }

    if (!wuzapiToken) {
      wuzapiToken = LOCAWEB_WUZAPI_TOKEN;
    }

    if (overrideWuzapiToken && overrideWuzapiToken !== item.wuzapi_token) {
      console.log(
        `🔑 [PJ-FILA] Usando token da instância mapeada (override) para ${item.user_id?.slice?.(0, 8) ?? 'n/a'}...`
      );
    }

    // 1️⃣ MARCAR COMO PROCESSANDO
    await supabase
      .from("fila_atendimento_pj")
      .update({ status: "processando" })
      .eq("id", item.id);

    // 2️⃣ ENVIAR STATUS "DIGITANDO" (humaniza) - apenas para texto/imagem
    if (tipoMensagem !== 'audio' && !destinoEhGrupo) {
      await enviarStatusDigitando(wuzapiUrl, wuzapiToken, phone);
    }

    // 3️⃣ AGUARDAR TEMPO DE DIGITAÇÃO (humaniza) - apenas para texto/imagem
    if (tipoMensagem !== 'audio' && !destinoEhGrupo) {
      const tempoDigitacao = calcularTempoDigitacao(mensagem);
      console.log(`⏳ [PJ-FILA] Simulando digitação por ${tempoDigitacao}ms...`);
      await sleep(tempoDigitacao);
    } else if (tipoMensagem !== 'audio') {
      await sleep(600);
    } else {
      // Pequeno delay para áudio
      await sleep(1000);
    }

    // 4️⃣ ENVIAR MENSAGEM/ÁUDIO/IMAGEM
    const resultado = await enviarMensagem(
      wuzapiUrl,
      wuzapiToken,
      phone,
      mensagem,
      item.imagem_url,
      audioBase64,
      tipoMensagem
    );

    const tempoTotal = Date.now() - startTime;

    if (!resultado.success) {
      throw new Error(resultado.error || "Erro ao enviar");
    }

    // 5️⃣ ATUALIZAR STATUS PARA ENVIADO
    await supabase
      .from("fila_atendimento_pj")
      .update({ 
        status: "enviado", 
        sent_at: new Date().toISOString(),
        erro: null
      })
      .eq("id", item.id);

    console.log(`✅ [PJ-FILA] Item ${item.id.slice(0, 8)} enviado em ${tempoTotal}ms`);

    return { success: true, tempoTotal };

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ [PJ-FILA] Erro no item ${item.id.slice(0, 8)}:`, errorMsg);

    const tentativas = (item.tentativas || 0) + 1;

    if (tentativas >= CONFIG.MAX_TENTATIVAS) {
      await supabase
        .from("fila_atendimento_pj")
        .update({ 
          status: "erro", 
          erro: errorMsg,
          tentativas
        })
        .eq("id", item.id);
    } else {
      await supabase
        .from("fila_atendimento_pj")
        .update({ 
          status: "pendente",
          scheduled_at: new Date(Date.now() + 30000).toISOString(),
          erro: errorMsg,
          tentativas,
          prioridade: Math.min((item.prioridade || 5) + 1, 10)
        })
        .eq("id", item.id);
    }

    return { success: false, error: errorMsg };
  }
}

// ═══════════════════════════════════════
// 🚀 HANDLER PRINCIPAL
// ═══════════════════════════════════════
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

    const body = await req.json().catch(() => ({}));
    const userId = body.userId || null;
    const batchSize = body.batchSize || CONFIG.BATCH_SIZE;

    console.log("🔄 ════════════════════════════════════════");
    console.log("🔄 [PJ-FILA] PROCESSANDO FILA DE ATENDIMENTO");
    console.log("🔄 ════════════════════════════════════════");

    // Buscar itens pendentes (usando select simples já que RPC pode não existir ainda)
    const { data: itens, error: filaError } = await supabase
      .from("fila_atendimento_pj")
      .select("*")
      .eq("status", "pendente")
      .lte("scheduled_at", new Date().toISOString())
      .lt("tentativas", CONFIG.MAX_TENTATIVAS)
      .order("prioridade", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (filaError) {
      console.error("❌ [PJ-FILA] Erro ao buscar fila:", filaError);
      throw filaError;
    }

    if (!itens || itens.length === 0) {
      console.log("📭 [PJ-FILA] Fila vazia - nada para processar");
      return new Response(
        JSON.stringify({ 
          success: true, 
          processed: 0, 
          message: "Fila vazia",
          duration_ms: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📋 [PJ-FILA] ${itens.length} itens para processar`);

    let processados = 0;
    let erros = 0;
    const resultados: any[] = [];

    for (const item of itens) {
      // Buscar URL real da instância WuzAPI para este usuário (IP:Porta)
      let wuzapiUrl = CONFIG.WUZAPI_URL;
      let mappedToken: string | null = null;

      // PRIORIDADE 1: wuzapi_url já gravado no item da fila (cobranca, etc.)
      if (item.wuzapi_url) {
        wuzapiUrl = String(item.wuzapi_url).replace(/\/+$/, "");
        const { data: inst } = await supabase
          .from("wuzapi_instances")
          .select("wuzapi_token")
          .eq("wuzapi_url", item.wuzapi_url)
          .maybeSingle();
        if (inst?.wuzapi_token) mappedToken = inst.wuzapi_token;
        console.log(`📡 [PJ-FILA] Usando wuzapi_url da fila: ${wuzapiUrl}`);
      } else if (item.user_id) {
        const { data: config } = await supabase
          .from("pj_clientes_config")
          .select("wuzapi_port")
          .eq("user_id", item.user_id)
          .maybeSingle();
        
        const targetPort = Number(config?.wuzapi_port || 8080);
        const mappedInstance = await buscarInstanciaConectada(supabase, item.user_id, targetPort);
        
        if (mappedInstance?.wuzapi_url) {
          wuzapiUrl = mappedInstance.wuzapi_url.replace(/\/+$/, "");
          console.log(`📡 [PJ-FILA] Usando instância real: ${wuzapiUrl} (porta ${mappedInstance.port || 'n/a'})`);
        }

        if (mappedInstance?.wuzapi_token) {
          mappedToken = mappedInstance.wuzapi_token;
        }
      }
      
      const resultado = await processarItem(supabase, item, wuzapiUrl, mappedToken);
      
      resultados.push({
        id: item.id,
        phone: item.lead_phone || item.phone,
        ...resultado
      });

      if (resultado.success) {
        processados++;
      } else {
        erros++;
      }

      // Delay anti-bloqueio entre mensagens
      if (itens.indexOf(item) < itens.length - 1) {
        const delay = calcularDelayAleatorio();
        console.log(`⏳ [PJ-FILA] Aguardando ${delay}ms antes do próximo...`);
        await sleep(delay);
      }
    }

    const duracao = Date.now() - startTime;
    
    console.log("\n🔄 ════════════════════════════════════════");
    console.log(`✅ [PJ-FILA] Processamento concluído!`);
    console.log(`   📤 Enviados: ${processados}`);
    console.log(`   ❌ Erros: ${erros}`);
    console.log(`   ⏱️ Duração: ${duracao}ms`);
    console.log("🔄 ════════════════════════════════════════\n");

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processados, 
        errors: erros,
        total: itens.length,
        duration_ms: duracao,
        resultados
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("💥 [PJ-FILA] Erro geral:", errorMsg);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMsg,
        duration_ms: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
