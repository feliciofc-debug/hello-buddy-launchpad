import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOCAWEB_WUZAPI_URL = Deno.env.get("WUZAPI_URL") || "https://wuzapi.amzofertas.com.br";
const LOCAWEB_WUZAPI_TOKEN = Deno.env.get("WUZAPI_TOKEN") || "";

// Função para delay humanizado
function getHumanDelay(): number {
  // Entre 3 e 8 segundos (anti-bloqueio)
  return Math.floor(Math.random() * 5000) + 3000;
}

// Função para simular digitação
function getTypingDelay(): number {
  // Entre 1.5 e 4 segundos
  return Math.floor(Math.random() * 2500) + 1500;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔄 [FILA-PJ] Iniciando processamento da fila...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar mensagens pendentes na fila (máximo 5 por execução)
    const { data: mensagensPendentes, error: fetchError } = await supabase
      .from("fila_atendimento_pj")
      .select("*")
      .eq("status", "pendente")
      .order("prioridade", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(5);

    if (fetchError) {
      console.error("❌ [FILA-PJ] Erro ao buscar fila:", fetchError);
      throw fetchError;
    }

    if (!mensagensPendentes || mensagensPendentes.length === 0) {
      console.log("✅ [FILA-PJ] Nenhuma mensagem pendente");
      return new Response(
        JSON.stringify({ success: true, processadas: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📬 [FILA-PJ] ${mensagensPendentes.length} mensagens para processar`);

    let processadas = 0;
    let erros = 0;

    for (const mensagem of mensagensPendentes) {
      try {
        // Marcar como processando
        await supabase
          .from("fila_atendimento_pj")
          .update({ status: "processando" })
          .eq("id", mensagem.id);

        // Buscar token do usuário
        let wuzapiToken = LOCAWEB_WUZAPI_TOKEN;
        if (mensagem.user_id) {
          const { data: config } = await supabase
            .from("pj_clientes_config")
            .select("wuzapi_token")
            .eq("user_id", mensagem.user_id)
            .maybeSingle();

          if (config?.wuzapi_token) {
            wuzapiToken = config.wuzapi_token;
          }
        }

        // Simular status "digitando" (anti-bloqueio)
        console.log(`⌨️ [FILA-PJ] Simulando digitação para ${mensagem.phone}...`);
        
        try {
          await fetch(`${LOCAWEB_WUZAPI_URL}/chat/presence`, {
            method: "POST",
            headers: {
              "Token": wuzapiToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              Phone: mensagem.phone.replace(/\D/g, ""),
              State: "composing",
            }),
          });
        } catch (e) {
          console.log("⚠️ Presence não suportado, continuando...");
        }

        // Delay de digitação
        await new Promise((r) => setTimeout(r, getTypingDelay()));

        // Enviar mensagem
        let response: Response;
        let payload: any;

        if (mensagem.tipo === "imagem" && mensagem.imagem_url) {
          // Enviar com imagem
          response = await fetch(`${LOCAWEB_WUZAPI_URL}/chat/send/image`, {
            method: "POST",
            headers: {
              "Token": wuzapiToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              Phone: mensagem.phone.replace(/\D/g, ""),
              Caption: mensagem.mensagem,
              Image: mensagem.imagem_url,
            }),
          });
        } else {
          // Enviar texto
          response = await fetch(`${LOCAWEB_WUZAPI_URL}/chat/send/text`, {
            method: "POST",
            headers: {
              "Token": wuzapiToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              Phone: mensagem.phone.replace(/\D/g, ""),
              Body: mensagem.mensagem,
            }),
          });
        }

        payload = await response.json();

        if (response.ok && payload?.success !== false) {
          // Sucesso
          await supabase
            .from("fila_atendimento_pj")
            .update({
              status: "enviado",
              processado_em: new Date().toISOString(),
            })
            .eq("id", mensagem.id);

          processadas++;
          console.log(`✅ [FILA-PJ] Enviado para ${mensagem.phone}`);
        } else {
          throw new Error(payload?.error || "Erro ao enviar");
        }

        // Delay humanizado entre mensagens
        await new Promise((r) => setTimeout(r, getHumanDelay()));

      } catch (msgError: any) {
        console.error(`❌ [FILA-PJ] Erro ao processar ${mensagem.phone}:`, msgError);

        const tentativas = (mensagem.tentativas || 0) + 1;
        const maxTentativas = mensagem.max_tentativas || 3;

        if (tentativas >= maxTentativas) {
          // Marcar como falha definitiva
          await supabase
            .from("fila_atendimento_pj")
            .update({
              status: "falha",
              erro: msgError.message,
              tentativas,
              processado_em: new Date().toISOString(),
            })
            .eq("id", mensagem.id);
        } else {
          // Voltar para pendente para retry
          await supabase
            .from("fila_atendimento_pj")
            .update({
              status: "pendente",
              tentativas,
              erro: msgError.message,
            })
            .eq("id", mensagem.id);
        }

        erros++;
      }
    }

    console.log(`📊 [FILA-PJ] Resultado: ${processadas} enviadas, ${erros} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        processadas,
        erros,
        total: mensagensPendentes.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ [FILA-PJ] Erro geral:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
