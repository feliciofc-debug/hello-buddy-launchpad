import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOCAWEB_WUZAPI_URL = Deno.env.get("WUZAPI_URL") || "https://wuzapi.amzofertas.com.br";
const LOCAWEB_WUZAPI_TOKEN = Deno.env.get("WUZAPI_TOKEN") || "";

// Função para normalizar número brasileiro com 9º dígito
function normalizeBrazilianPhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  
  // Remover 55 do início se existir
  if (clean.startsWith("55") && clean.length >= 12) {
    clean = clean.substring(2);
  }
  
  // Se tem 10 dígitos (DDD + 8 dígitos), adicionar o 9
  // DDDs válidos: 11-99
  if (clean.length === 10) {
    const ddd = clean.substring(0, 2);
    const numero = clean.substring(2);
    // Celulares começam com 9, 8, 7 ou 6 após o DDD
    if (['9', '8', '7', '6'].includes(numero[0])) {
      clean = ddd + '9' + numero;
      console.log(`📱 [NORMALIZE] Adicionado 9º dígito: ${phone} -> 55${clean}`);
    }
  }
  
  // Garantir prefixo 55
  if (!clean.startsWith("55")) {
    clean = "55" + clean;
  }
  
  return clean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumbers, message, imageUrl, userId, useQueue = false } = await req.json();

    console.log("📤 [PJ-SEND] Recebido:", {
      phones: phoneNumbers?.length,
      hasImage: !!imageUrl,
      userId,
      useQueue,
    });

    if (!phoneNumbers || phoneNumbers.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum telefone informado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configuração do usuário PJ (igual ao sistema antigo - usar IP:Porta real)
    let baseUrl = LOCAWEB_WUZAPI_URL;
    let wuzapiToken = LOCAWEB_WUZAPI_TOKEN;
    
    if (userId) {
      const { data: config } = await supabase
        .from("pj_clientes_config")
        .select("wuzapi_token, wuzapi_port")
        .eq("user_id", userId)
        .maybeSingle();

      if (config?.wuzapi_token) {
        wuzapiToken = config.wuzapi_token;
      }
      
      // Buscar instância mapeada com IP:Porta real (não usar domínio)
      const targetPort = Number(config?.wuzapi_port || 8080);
      const { data: mappedInstance } = await supabase
        .from("wuzapi_instances")
        .select("wuzapi_url, wuzapi_token")
        .eq("assigned_to_user", userId)
        .eq("port", targetPort)
        .maybeSingle();
      
      if (mappedInstance?.wuzapi_url) {
        baseUrl = mappedInstance.wuzapi_url.replace(/\/+$/, "");
        console.log("📡 [PJ-SEND] Usando instância:", baseUrl);
      }
      if (mappedInstance?.wuzapi_token) {
        wuzapiToken = mappedInstance.wuzapi_token;
      }
    }

    // Se deve usar fila anti-bloqueio
    if (useQueue) {
      const filaItems = phoneNumbers.map((phone: string) => ({
        user_id: userId,
        phone: phone.replace(/\D/g, ""),
        mensagem: message,
        tipo: imageUrl ? "imagem" : "texto",
        imagem_url: imageUrl || null,
        status: "pendente",
        prioridade: 5,
      }));

      const { error: insertError } = await supabase
        .from("fila_atendimento_pj")
        .insert(filaItems);

      if (insertError) {
        throw insertError;
      }

      console.log(`📬 [PJ-SEND] ${filaItems.length} mensagens adicionadas à fila`);

      return new Response(
        JSON.stringify({
          success: true,
          queued: true,
          total: filaItems.length,
          message: "Mensagens adicionadas à fila anti-bloqueio",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Envio direto (sem fila)
    const results: any[] = [];

    for (const phone of phoneNumbers) {
      // Normalizar número com 9º dígito brasileiro
      const cleanPhone = normalizeBrazilianPhone(phone);
      console.log(`📞 [PJ-SEND] Enviando para ${cleanPhone}...`);

      try {
        let response: Response;
        let payload: any;

        if (imageUrl) {
          response = await fetch(`${baseUrl}/chat/send/image`, {
            method: "POST",
            headers: {
              "Token": wuzapiToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              Phone: cleanPhone,
              Caption: message,
              Image: imageUrl,
            }),
          });

          payload = await response.json();

          // Fallback se imagem falhar (QUALQUER motivo)
          // Motivo: algumas infraestruturas bloqueiam fetch de imagem (403), timeouts, etc.
          // Não podemos deixar o cliente sem receber nada; texto deve sempre ir.
          if (!response.ok || payload?.success === false) {
            const errMsg = payload?.error || "";
            console.log("🧯 [PJ-SEND] Imagem falhou, fallback para texto...", {
              status: response.status,
              error: errMsg,
            });

            response = await fetch(`${baseUrl}/chat/send/text`, {
              method: "POST",
              headers: {
                "Token": wuzapiToken,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                Phone: cleanPhone,
                Body: message,
              }),
            });
            payload = await response.json();
          }
        } else {
          response = await fetch(`${baseUrl}/chat/send/text`, {
            method: "POST",
            headers: {
              "Token": wuzapiToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              Phone: cleanPhone,
              Body: message,
            }),
          });
          payload = await response.json();
        }

        const success = response.ok && payload?.success !== false;

        results.push({
          phone: cleanPhone,
          success,
          response: payload,
        });

        if (success) {
          console.log(`✅ [PJ-SEND] Enviado para ${cleanPhone}`);
        } else {
          console.error(`❌ [PJ-SEND] Falha para ${cleanPhone}:`, payload);
        }

      } catch (fetchErr: any) {
        console.error(`❌ [PJ-SEND] Erro para ${cleanPhone}:`, fetchErr);
        results.push({
          phone: cleanPhone,
          success: false,
          error: fetchErr.message,
        });
      }

      // Delay entre envios
      await new Promise((r) => setTimeout(r, 500));
    }

    const enviados = results.filter((r) => r.success).length;
    const erros = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        enviados,
        erros,
        total: phoneNumbers.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ [PJ-SEND] Erro geral:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
