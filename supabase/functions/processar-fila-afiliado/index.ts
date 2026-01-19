// ============================================
// PROCESSAR FILA DE ATENDIMENTO - EDGE FUNCTION
// AMZ Ofertas - Sistema Anti-Bloqueio WhatsApp
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════
// 🔧 CONFIGURAÇÕES ANTI-BLOQUEIO
// ═══════════════════════════════════════
const CONFIG = {
  // Delays entre mensagens (mais humano)
  DELAY_MIN_MS: 3000,           // 3 segundos mínimo entre msgs
  DELAY_MAX_MS: 8000,           // 8 segundos máximo entre msgs
  DELAY_POR_CARACTERE_MS: 25,   // 25ms por caractere (simular digitação)
  
  // Tempo de "digitando" visível pro cliente
  TEMPO_TYPING_MIN_MS: 1500,    // Mínimo 1.5s "digitando"
  TEMPO_TYPING_MAX_MS: 4000,    // Máximo 4s "digitando"
  TEMPO_TYPING_POR_CHAR_MS: 20, // +20ms por caractere
  
  // Rate limits
  MAX_MSGS_POR_MINUTO: 20,      // Máximo 20 msgs/min por instância
  MAX_MSGS_POR_HORA: 150,       // Máximo 150 msgs/hora
  MAX_MSGS_POR_DIA: 1000,       // Máximo 1000 msgs/dia
  
  // Processamento
  BATCH_SIZE: 3,                // Processar 3 por vez
  MAX_TENTATIVAS: 3,            // Máximo 3 tentativas por msg
  
  // WuzAPI URL será buscada dinamicamente das instâncias
};

// ═══════════════════════════════════════
// 🔧 FUNÇÕES AUXILIARES
// ═══════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calcularTempoDigitacao(mensagem: string): number {
  const tamanho = mensagem?.length || 0;
  
  // Base aleatória entre min e max
  const base = CONFIG.TEMPO_TYPING_MIN_MS + 
    Math.random() * (CONFIG.TEMPO_TYPING_MAX_MS - CONFIG.TEMPO_TYPING_MIN_MS);
  
  // Adicional baseado no tamanho
  const porCaractere = Math.min(tamanho * CONFIG.TEMPO_TYPING_POR_CHAR_MS, 5000);
  
  // Cap em 8 segundos (não parecer travado)
  return Math.min(base + porCaractere, 8000);
}

function calcularDelayAleatorio(): number {
  return CONFIG.DELAY_MIN_MS + 
    Math.random() * (CONFIG.DELAY_MAX_MS - CONFIG.DELAY_MIN_MS);
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
    // Formatar telefone
    let formattedPhone = phone.replace(/\D/g, "");
    if (!formattedPhone.startsWith("55") && formattedPhone.length === 11) {
      formattedPhone = "55" + formattedPhone;
    }

    const baseUrl = wuzapiUrl.endsWith('/') ? wuzapiUrl.slice(0, -1) : wuzapiUrl;

    // Tentar endpoint de presence/composing
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
      console.log(`⌨️ Status "digitando" enviado para ${formattedPhone}`);
      return true;
    }
    
    // Se endpoint principal falhar, tentar alternativo
    const response2 = await fetch(`${baseUrl}/chat/markcomposing`, {
      method: "POST",
      headers: { 
        "Token": token, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        Phone: formattedPhone
      })
    });

    return response2.ok;
  } catch (e: unknown) {
    // Não é crítico - só log
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.log("⚠️ Não foi possível enviar status digitando:", errorMsg);
    return false;
  }
}

// ═══════════════════════════════════════
// 📤 ENVIAR MENSAGEM
// ═══════════════════════════════════════
async function enviarMensagem(
  wuzapiUrl: string,
  token: string,
  phone: string,
  message: string,
  imageUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Formatar telefone
    let formattedPhone = phone.replace(/\D/g, "");
    if (!formattedPhone.startsWith("55") && formattedPhone.length === 11) {
      formattedPhone = "55" + formattedPhone;
    }

    const baseUrl = wuzapiUrl.endsWith('/') ? wuzapiUrl.slice(0, -1) : wuzapiUrl;
    const endpoint = imageUrl 
      ? `${baseUrl}/chat/send/image`
      : `${baseUrl}/chat/send/text`;

    const payload = imageUrl
      ? { Phone: formattedPhone, Image: imageUrl, Caption: message }
      : { Phone: formattedPhone, Body: message };

    console.log(`📤 Enviando para ${formattedPhone}...`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { 
        "Token": token, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`❌ Erro HTTP ${response.status}:`, responseText);
      return { success: false, error: `HTTP ${response.status}: ${responseText}` };
    }

    // Verificar resposta
    try {
      const data = JSON.parse(responseText);
      if (data.success === false || data.error) {
        return { success: false, error: data.error || "Erro desconhecido" };
      }
    } catch {
      // Resposta não é JSON, mas HTTP OK = sucesso
    }

    console.log(`✅ Mensagem enviada para ${formattedPhone}`);
    return { success: true };

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ Erro ao enviar:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

// ═══════════════════════════════════════
// 🔄 PROCESSAR ITEM DA FILA
// ═══════════════════════════════════════
async function processarItem(
  supabase: any,
  item: any
): Promise<{ success: boolean; error?: string; tempoTotal?: number }> {
  const startTime = Date.now();

  try {
    console.log(`\n📋 Processando item ${item.id.slice(0, 8)}...`);
    console.log(`   📱 Lead: ${item.lead_phone}`);
    console.log(`   👤 Nome: ${item.lead_name || "Desconhecido"}`);
    console.log(`   📝 Tipo: ${item.tipo_mensagem}`);

    // Verificar se tem token e URL
    if (!item.wuzapi_token) {
      throw new Error("Token WuzAPI não encontrado");
    }
    
    // Buscar URL da instância (pode estar no item ou buscar)
    let wuzapiUrl = item.wuzapi_url;
    if (!wuzapiUrl) {
      // Tentar buscar da instância
      const { data: instance } = await supabase
        .from('wuzapi_instances')
        .select('wuzapi_url')
        .eq('wuzapi_token', item.wuzapi_token)
        .eq('is_connected', true)
        .limit(1)
        .maybeSingle();
      
      if (instance?.wuzapi_url) {
        wuzapiUrl = instance.wuzapi_url;
      } else {
        // Fallback para variável de ambiente
        wuzapiUrl = Deno.env.get('WUZAPI_URL') || "https://api2.amzofertas.com.br";
      }
    }

    // Verificar se tem resposta
    if (!item.resposta_ia) {
      throw new Error("Resposta IA não encontrada");
    }

    // ═══════════════════════════════════════
    // 1️⃣ ENVIAR STATUS "DIGITANDO"
    // ═══════════════════════════════════════
    await supabase
      .from("fila_atendimento_afiliado")
      .update({ status: "digitando" })
      .eq("id", item.id);

    await enviarStatusDigitando(wuzapiUrl, item.wuzapi_token, item.lead_phone);

    // ═══════════════════════════════════════
    // 2️⃣ AGUARDAR TEMPO DE DIGITAÇÃO
    // ═══════════════════════════════════════
    const tempoDigitacao = calcularTempoDigitacao(item.resposta_ia);
    console.log(`⏳ Simulando digitação por ${tempoDigitacao}ms...`);
    await sleep(tempoDigitacao);

    // ═══════════════════════════════════════
    // 3️⃣ ENVIAR MENSAGEM
    // ═══════════════════════════════════════
    const resultado = await enviarMensagem(
      wuzapiUrl,
      item.wuzapi_token,
      item.lead_phone,
      item.resposta_ia,
      item.imagem_url
    );

    const tempoTotal = Date.now() - startTime;

    if (!resultado.success) {
      throw new Error(resultado.error || "Erro ao enviar");
    }

    // ═══════════════════════════════════════
    // 4️⃣ ATUALIZAR STATUS PARA ENVIADO
    // ═══════════════════════════════════════
    await supabase
      .from("fila_atendimento_afiliado")
      .update({ 
        status: "enviado", 
        sent_at: new Date().toISOString(),
        erro: null
      })
      .eq("id", item.id);

    console.log(`✅ Item ${item.id.slice(0, 8)} enviado em ${tempoTotal}ms`);

    return { success: true, tempoTotal };

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Erro no item ${item.id.slice(0, 8)}:`, errorMsg);

    // Verificar tentativas
    if (item.tentativas >= CONFIG.MAX_TENTATIVAS) {
      // Marcar como erro definitivo
      await supabase
        .from("fila_atendimento_afiliado")
        .update({ 
          status: "erro", 
          erro: errorMsg
        })
        .eq("id", item.id);
    } else {
      // Reagendar com prioridade menor
      await supabase
        .from("fila_atendimento_afiliado")
        .update({ 
          status: "pendente",
          scheduled_at: new Date(Date.now() + 30000).toISOString(), // +30s
          erro: errorMsg,
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

    // Parâmetros opcionais
    const body = await req.json().catch(() => ({}));
    const userId = body.userId || null;
    const batchSize = body.batchSize || CONFIG.BATCH_SIZE;
    const testMode = body.testMode || false;

    console.log("🔄 ════════════════════════════════════════");
    console.log("🔄 PROCESSANDO FILA DE ATENDIMENTO");
    console.log(`🔄 Modo teste: ${testMode}`);
    console.log("🔄 ════════════════════════════════════════");

    // ═══════════════════════════════════════
    // 1️⃣ BUSCAR ITENS PENDENTES
    // ═══════════════════════════════════════
    const { data: itens, error: filaError } = await supabase
      .rpc("pegar_proximo_fila_afiliado", { 
        p_user_id: userId, 
        p_limit: batchSize 
      });

    if (filaError) {
      console.error("❌ Erro ao buscar fila:", filaError);
      throw filaError;
    }

    if (!itens || itens.length === 0) {
      console.log("📭 Fila vazia - nada para processar");
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

    console.log(`📋 ${itens.length} itens para processar`);

    // ═══════════════════════════════════════
    // 2️⃣ PROCESSAR CADA ITEM
    // ═══════════════════════════════════════
    let processados = 0;
    let erros = 0;
    const resultados: any[] = [];

    for (const item of itens) {
      const resultado = await processarItem(supabase, item);
      
      resultados.push({
        id: item.id,
        phone: item.lead_phone,
        ...resultado
      });

      if (resultado.success) {
        processados++;
      } else {
        erros++;
      }

      // Delay entre mensagens (anti-bloqueio)
      if (itens.indexOf(item) < itens.length - 1) {
        const delay = calcularDelayAleatorio();
        console.log(`⏳ Aguardando ${delay}ms antes do próximo...`);
        await sleep(delay);
      }
    }

    // ═══════════════════════════════════════
    // 3️⃣ RESULTADO
    // ═══════════════════════════════════════
    const duracao = Date.now() - startTime;
    
    console.log("\n🔄 ════════════════════════════════════════");
    console.log(`✅ Processamento concluído!`);
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
    console.error("💥 Erro geral:", errorMsg);
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
