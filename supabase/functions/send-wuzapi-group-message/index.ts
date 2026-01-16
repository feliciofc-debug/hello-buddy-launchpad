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

    // Estratégia "texto primeiro" para garantir que o link/oferta sempre chegue.
    // Depois, se houver imagem (e não for .webp), tenta enviar como segunda mensagem.
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

    const sendImage = async (url: string) => {
      const endpoint = `${CONTABO_WUZAPI_URL}/chat/send/image`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Token: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Phone: groupPhone,
          // evitar duplicar a mensagem (já foi enviada no texto)
          Caption: "",
          Image: url,
        }),
      });

      const result = await response.json().catch(() => null);
      return { endpoint, response, result };
    };

    // 1) Envia TEXTO sempre
    const textSend = await sendText();
    console.log("Resultado envio (texto):", JSON.stringify(textSend.result));

    // 2) Tenta imagem como follow-up (best effort)
    let imageAttempt:
      | { attempted: false; skippedReason?: string }
      | { attempted: true; endpoint: string; ok: boolean; result: any } = { attempted: false };

    if (imageUrl) {
      const lower = String(imageUrl).toLowerCase();
      // WebP costuma falhar em alguns clientes/fluxos — melhor não arriscar travar o envio
      if (lower.includes(".webp")) {
        imageAttempt = { attempted: false, skippedReason: "webp" };
        console.log("⚠️ Imagem .webp detectada — pulando envio de mídia (texto já enviado).", imageUrl);
      } else {
        const imageSend = await sendImage(imageUrl);
        imageAttempt = {
          attempted: true,
          endpoint: imageSend.endpoint,
          ok: imageSend.response.ok,
          result: imageSend.result,
        };

        if (imageSend.response.ok) {
          console.log("Resultado envio (imagem):", JSON.stringify(imageSend.result));
        } else {
          console.log("⚠️ Falha ao enviar imagem (texto já foi enviado):", JSON.stringify(imageSend.result));
        }
      }
    }

    // Log do envio (considera sucesso = texto ok)
    await supabase.from("historico_envios").insert({
      whatsapp: groupJid,
      tipo: "grupo",
      mensagem: message.substring(0, 200),
      sucesso: textSend.response.ok,
      erro: textSend.response.ok
        ? null
        : JSON.stringify({ text: textSend.result, imageAttempt }),
    });

    // Atualizar contador de mensagens do grupo
    if (textSend.response.ok) {
      await supabase.rpc("increment_group_messages", { group_jid: groupJid });
    }

    return new Response(
      JSON.stringify({
        success: textSend.response.ok,
        text: { endpoint: textSend.endpoint, result: textSend.result },
        imageAttempt,
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
