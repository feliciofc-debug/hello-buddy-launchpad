// ============================================
// HEALTH CHECK - EDGE FUNCTIONS MONITOR
// AMZ Ofertas - Monitoramento Automático 24/7
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Funções críticas a serem monitoradas
const CRITICAL_FUNCTIONS = [
  'executar-envio-programado',
  'processar-fila-afiliado',
  'send-wuzapi-message-afiliado',
  'send-wuzapi-group-message',
  'wuzapi-webhook-afiliados',
  'wuzapi-webhook-pj',
  'send-wuzapi-message-pj',
  'executar-campanhas-agendadas',
  'send-wuzapi-group-message-pj'
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: Record<string, { status: string; latency_ms: number; error?: string }> = {};
  let offlineCount = 0;
  let onlineCount = 0;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  console.log(`🏥 [HEALTH CHECK] Iniciando verificação de ${CRITICAL_FUNCTIONS.length} funções...`);

  // Verificar cada função em paralelo
  const checks = CRITICAL_FUNCTIONS.map(async (funcName) => {
    const funcStart = Date.now();
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/${funcName}`, {
        method: "OPTIONS",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
        },
      });

      const latency = Date.now() - funcStart;
      
      // OPTIONS deve retornar 200 ou 204 se a função existir
      if (response.ok || response.status === 204) {
        results[funcName] = { status: 'online', latency_ms: latency };
        onlineCount++;
        console.log(`✅ ${funcName}: ONLINE (${latency}ms)`);
      } else {
        results[funcName] = { 
          status: 'offline', 
          latency_ms: latency, 
          error: `HTTP ${response.status}` 
        };
        offlineCount++;
        console.log(`❌ ${funcName}: OFFLINE (HTTP ${response.status})`);
      }
    } catch (error: any) {
      const latency = Date.now() - funcStart;
      results[funcName] = { 
        status: 'error', 
        latency_ms: latency, 
        error: error.message 
      };
      offlineCount++;
      console.log(`❌ ${funcName}: ERROR - ${error.message}`);
    }
  });

  await Promise.all(checks);

  const totalTime = Date.now() - startTime;

  // Atualizar status no banco de dados
  for (const [funcName, result] of Object.entries(results)) {
    const updateData: any = {
      last_check: new Date().toISOString(),
      status: result.status,
      updated_at: new Date().toISOString(),
    };

    if (result.status === 'online') {
      updateData.last_online = new Date().toISOString();
      updateData.consecutive_failures = 0;
      updateData.last_error = null;
    } else {
      updateData.last_error = result.error || 'Unknown error';
    }

    // Atualizar ou inserir
    const { data: existing } = await supabase
      .from('edge_functions_health')
      .select('id, consecutive_failures, status')
      .eq('function_name', funcName)
      .single();

    if (existing) {
      // Se estava online e agora offline, incrementar falhas
      if (result.status !== 'online') {
        updateData.consecutive_failures = (existing.consecutive_failures || 0) + 1;
      }

      // Registrar incidente se mudou de status
      if (existing.status !== result.status) {
        const incidentType = result.status === 'online' ? 'recovered' : 'offline';
        await supabase.from('edge_functions_incidents').insert({
          function_name: funcName,
          incident_type: incidentType,
          details: result.status === 'online' 
            ? `Função restaurada após ${existing.consecutive_failures || 0} falhas` 
            : `Função offline: ${result.error}`,
        });
      }

      await supabase
        .from('edge_functions_health')
        .update(updateData)
        .eq('id', existing.id);
    } else {
      // Inserir novo registro
      await supabase.from('edge_functions_health').insert({
        function_name: funcName,
        ...updateData,
        is_critical: true,
      });
    }
  }

  // Log resumo
  console.log(`\n📊 [HEALTH CHECK] Resumo:`);
  console.log(`   ✅ Online: ${onlineCount}`);
  console.log(`   ❌ Offline: ${offlineCount}`);
  console.log(`   ⏱️ Tempo total: ${totalTime}ms`);

  // Se houver funções offline, registrar alerta
  if (offlineCount > 0) {
    console.log(`\n🚨 ALERTA: ${offlineCount} função(ões) crítica(s) offline!`);
    
    // Poderia enviar notificação por WhatsApp/email aqui
  }

  return new Response(
    JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: totalTime,
      summary: {
        total: CRITICAL_FUNCTIONS.length,
        online: onlineCount,
        offline: offlineCount,
      },
      results,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
