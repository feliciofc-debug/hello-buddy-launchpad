import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTABO_WUZAPI_URL = "https://api2.amzofertas.com.br";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumbers, message, imageUrl, userId } = await req.json();

    console.log("📤 [AFILIADO-EDGE] Recebido:", { 
      phones: phoneNumbers?.length, 
      hasImage: !!imageUrl, 
      userId 
    });

    if (!phoneNumbers || phoneNumbers.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum telefone informado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "userId não informado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar token Wuzapi do cliente afiliado
    const { data: clienteAfiliado, error: clienteError } = await supabase
      .from("clientes_afiliados")
      .select("wuzapi_token, wuzapi_jid")
      .eq("user_id", userId)
      .maybeSingle();

    if (clienteError || !clienteAfiliado) {
      console.error("❌ [AFILIADO-EDGE] Erro ao buscar cliente:", clienteError);
      return new Response(
        JSON.stringify({ success: false, error: "Cliente afiliado não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!clienteAfiliado.wuzapi_token) {
      console.error("❌ [AFILIADO-EDGE] Token Wuzapi não configurado");
      return new Response(
        JSON.stringify({ success: false, error: "Token Wuzapi não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const wuzapiToken = clienteAfiliado.wuzapi_token;
    const results: any[] = [];

    // Enviar para cada telefone
    for (const phone of phoneNumbers) {
      const cleanPhone = phone.replace(/\D/g, "");
      console.log(`📞 [AFILIADO-EDGE] Enviando para ${cleanPhone}...`);

      try {
        let response: Response;
        let payload: any;

        if (imageUrl) {
          // Enviar COM imagem
          console.log(`🖼️ [AFILIADO-EDGE] Enviando com imagem: ${imageUrl.substring(0, 50)}...`);
          
          response = await fetch(`${CONTABO_WUZAPI_URL}/chat/send/image`, {
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
          console.log(`📸 [AFILIADO-EDGE] Resposta imagem:`, { ok: response.ok, payload });

          // Se falhou COM IMAGEM por erro de upload → tenta SEM IMAGEM
          if (!response.ok || payload?.success === false) {
            const errMsg = payload?.error || payload?.message || "";
            const isMediaError =
              errMsg.toLowerCase().includes("upload") ||
              errMsg.toLowerCase().includes("media") ||
              errMsg.toLowerCase().includes("websocket") ||
              errMsg.toLowerCase().includes("timed out");

            if (isMediaError) {
              console.log("🧯 [AFILIADO-EDGE] Falha com imagem, reenviando SEM imagem...");
              
              response = await fetch(`${CONTABO_WUZAPI_URL}/chat/send/text`, {
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
              console.log(`💬 [AFILIADO-EDGE] Resposta texto (retry):`, { ok: response.ok, payload });
            }
          }
        } else {
          // Enviar SEM imagem (só texto)
          console.log(`💬 [AFILIADO-EDGE] Enviando só texto`);
          
          response = await fetch(`${CONTABO_WUZAPI_URL}/chat/send/text`, {
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
          console.log(`💬 [AFILIADO-EDGE] Resposta texto:`, { ok: response.ok, payload });
        }

        const success = response.ok && payload?.success !== false;

        results.push({
          phone: cleanPhone,
          success,
          response: payload,
        });

        if (success) {
          console.log(`✅ [AFILIADO-EDGE] Enviado para ${cleanPhone}`);
        } else {
          console.error(`❌ [AFILIADO-EDGE] Falha para ${cleanPhone}:`, payload);
        }

      } catch (fetchErr: any) {
        console.error(`❌ [AFILIADO-EDGE] Erro fetch para ${cleanPhone}:`, fetchErr);
        results.push({
          phone: cleanPhone,
          success: false,
          error: fetchErr.message,
        });
      }

      // Delay entre envios
      await new Promise((r) => setTimeout(r, 300));
    }

    const enviados = results.filter((r) => r.success).length;
    const erros = results.filter((r) => !r.success).length;

    console.log(`📊 [AFILIADO-EDGE] Resultado: ${enviados} enviados, ${erros} erros`);

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
    console.error("❌ [AFILIADO-EDGE] Erro geral:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
