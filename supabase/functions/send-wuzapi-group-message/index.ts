import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTABO_WUZAPI_URL = "https://api2.amzofertas.com.br";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { groupJid, message, imageUrl, userId } = await req.json();

    if (!groupJid || !message || !userId) {
      return new Response(
        JSON.stringify({ error: "groupJid, message e userId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar token do afiliado
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes_afiliados")
      .select("wuzapi_token")
      .eq("user_id", userId)
      .single();

    if (clienteError || !cliente?.wuzapi_token) {
      console.error("Erro ao buscar cliente:", clienteError);
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado ou sem token WuzAPI" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = cliente.wuzapi_token;

    // Para grupos, o WuzAPI precisa do JID completo com @g.us no campo Phone
    const groupPhone = groupJid.includes("@g.us") ? groupJid : `${groupJid}@g.us`;

    console.log(`Enviando mensagem para grupo: ${groupPhone}`);

    // Estratégia: enviar com IMAGEM+LEGENDA (texto+link juntos).
    // Se falhar, faz fallback para TEXTO.
    const sendText = async () => {
      const endpoint = `${CONTABO_WUZAPI_URL}/chat/send/text`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Token: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Phone: groupPhone,
          Body: message,
        }),
      });

      const result = await response.json().catch(() => null);
      return { endpoint, response, result };
    };

    // ╔══════════════════════════════════════════════════════════════════════════════╗
    // ║ 🔒 CÓDIGO PROTEGIDO - NÃO ALTERAR SEM AUTORIZAÇÃO EXPLÍCITA DO USUÁRIO!     ║
    // ║                                                                              ║
    // ║ PROBLEMA RESOLVIDO: Proxy images.weserv.nl retornava 404 para URLs Shopee   ║
    // ║ SOLUÇÃO: WuzAPI aceita .webp diretamente - NÃO usar proxy de conversão!     ║
    // ║                                                                              ║
    // ║ Data da correção: 17/01/2026                                                 ║
    // ║ Testado e confirmado funcionando pelo usuário.                               ║
    // ╚══════════════════════════════════════════════════════════════════════════════╝
    const normalizeImageUrl = (url: string) => {
      // ⚠️ NÃO ADICIONAR PROXY AQUI! WuzAPI aceita .webp direto da Shopee!
      console.log("📸 Usando URL original (sem proxy):", url);
      return url;
    };

    const sendImageWithCaption = async (url: string, caption: string) => {
      const endpoint = `${CONTABO_WUZAPI_URL}/chat/send/image`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Token: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Phone: groupPhone,
          Caption: caption,
          Image: url,
        }),
      });

      const result = await response.json().catch(() => null);
      return { endpoint, response, result };
    };

    // 1) Se tem imagem: tenta IMAGEM+LEGENDA (junto). Se falhar, faz fallback para texto.
    let textSend: Awaited<ReturnType<typeof sendText>> | null = null;
    let imageSend:
      | null
      | { endpoint: string; response: Response; result: any; normalizedUrl: string } = null;

    if (imageUrl) {
      const normalizedUrl = normalizeImageUrl(String(imageUrl));
      const attempt = await sendImageWithCaption(normalizedUrl, message);
      imageSend = {
        endpoint: attempt.endpoint,
        response: attempt.response,
        result: attempt.result,
        normalizedUrl,
      };

      if (attempt.response.ok) {
        console.log("✅ Envio (imagem+legenda) OK:", JSON.stringify(attempt.result));
      } else {
        console.log(
          "⚠️ Falha no envio (imagem+legenda). Fazendo fallback para TEXTO...",
          JSON.stringify(attempt.result),
        );
        textSend = await sendText();
        console.log("Resultado envio (texto fallback):", JSON.stringify(textSend.result));
      }
    } else {
      textSend = await sendText();
      console.log("Resultado envio (texto):", JSON.stringify(textSend.result));
    }

    const success = imageSend ? imageSend.response.ok || Boolean(textSend?.response.ok) : Boolean(textSend?.response.ok);

    // ╔════════════════════════════════════════════════════════════════════════════╗
    // ║ 🔒 LOGS DETALHADOS - 17/01/2026 - Debug de entrega real                    ║
    // ╚════════════════════════════════════════════════════════════════════════════╝
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📤 ENVIO PARA GRUPO: ${groupJid}`);
    console.log(`🖼️ Imagem: ${imageUrl ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`📡 Status Imagem: ${imageSend?.response.status ?? 'N/A'} | OK: ${imageSend?.response.ok ?? 'N/A'}`);
    console.log(`📡 Status Texto: ${textSend?.response.status ?? 'N/A'} | OK: ${textSend?.response.ok ?? 'N/A'}`);
    console.log(`✅ Sucesso Final: ${success}`);
    if (imageSend?.result) console.log(`📋 Response Imagem: ${JSON.stringify(imageSend.result)}`);
    if (textSend?.result) console.log(`📋 Response Texto: ${JSON.stringify(textSend.result)}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Log do envio no banco
    await supabase.from("historico_envios").insert({
      whatsapp: groupJid,
      tipo: "grupo",
      mensagem: message.substring(0, 200),
      sucesso: success,
      erro: success
        ? null
        : JSON.stringify({
            image: imageSend
              ? {
                  endpoint: imageSend.endpoint,
                  ok: imageSend.response.ok,
                  result: imageSend.result,
                  normalizedUrl: imageSend.normalizedUrl,
                }
              : null,
            text: textSend ? { endpoint: textSend.endpoint, ok: textSend.response.ok, result: textSend.result } : null,
          }),
    });

    // Atualizar contador de mensagens do grupo
    if (success) {
      await supabase.rpc("increment_group_messages", { group_jid: groupJid });
    }

    return new Response(
      JSON.stringify({
        success,
        image: imageSend
          ? {
              endpoint: imageSend.endpoint,
              ok: imageSend.response.ok,
              result: imageSend.result,
            }
          : null,
        text: textSend
          ? {
              endpoint: textSend.endpoint,
              ok: textSend.response.ok,
              result: textSend.result,
            }
          : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Erro geral:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
