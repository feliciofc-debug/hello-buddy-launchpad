import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PostRequest {
  user_id: string;
  content_type: "image" | "video";
  content_url: string;
  title: string;
  post_mode: "direct" | "draft";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id, content_type, content_url, title, post_mode }: PostRequest = await req.json();

    if (!user_id || !content_url || !title) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros obrigatórios faltando" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar token do usuário
    const { data: integration, error: integrationError } = await supabase
      .from("integrations")
      .select("*")
      .eq("user_id", user_id)
      .eq("platform", "tiktok")
      .eq("is_active", true)
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ success: false, error: "TikTok não conectado. Por favor, conecte sua conta primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = integration.access_token;

    // Verificar se token expirou
    if (integration.token_expires_at && new Date(integration.token_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "Token expirado. Por favor, reconecte sua conta TikTok." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === PASSO 1: Baixar o vídeo do Supabase Storage ===
    console.log("📥 Baixando vídeo do storage:", content_url);
    const videoResponse = await fetch(content_url);
    if (!videoResponse.ok) {
      console.error("❌ Falha ao baixar vídeo:", videoResponse.status, videoResponse.statusText);
      return new Response(
        JSON.stringify({ success: false, error: "Falha ao baixar o vídeo do storage." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    const videoBytes = new Uint8Array(videoBuffer);
    const videoSize = videoBytes.length;
    console.log("✅ Vídeo baixado:", videoSize, "bytes");

    // === PASSO 2: Iniciar upload no TikTok (FILE_UPLOAD) ===
    // SANDBOX: Forçar endpoint de inbox/rascunho — apps não auditados não podem usar /publish/video/init/
    const endpoint = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";

    // App em modo sandbox: TikTok só permite SELF_ONLY até aprovação
    // Após aprovação do app, trocar para: post_mode === "direct" ? "PUBLIC_TO_EVERYONE" : "SELF_ONLY"
    const privacyLevel = "SELF_ONLY";

    const tiktokPayload = {
      post_info: {
        title: title.substring(0, 150),
        privacy_level: privacyLevel,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    };

    console.log("📤 Iniciando upload no TikTok:", { endpoint, payload: tiktokPayload });

    const initResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(tiktokPayload),
    });

    const initData = await initResponse.json();
    console.log("📦 Resposta init TikTok:", JSON.stringify(initData));

    if (initData.error?.code) {
      let errorMessage = "Erro ao iniciar upload no TikTok";
      switch (initData.error.code) {
        case "access_token_invalid":
          errorMessage = "Token inválido. Reconecte sua conta TikTok.";
          break;
        case "rate_limit_exceeded":
          errorMessage = "Limite de requisições atingido. Tente novamente em alguns minutos.";
          break;
        case "spam_risk_too_many_posts":
          errorMessage = "Muitas publicações recentes. Aguarde um pouco.";
          break;
        default:
          errorMessage = initData.error.message || errorMessage;
      }

      return new Response(
        JSON.stringify({ success: false, error: errorMessage, tiktok_error: initData.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uploadUrl = initData.data?.upload_url;
    const publishId = initData.data?.publish_id;

    if (!uploadUrl) {
      console.error("❌ Sem upload_url na resposta:", initData);
      return new Response(
        JSON.stringify({ success: false, error: "TikTok não retornou URL de upload.", tiktok_response: initData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("📤 Fazendo upload do vídeo para:", uploadUrl, "tamanho:", videoSize);

    // === PASSO 3: Upload do vídeo via PUT ===
    let uploadStatus: number;
    let uploadText: string;
    try {
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`,
          "Content-Type": "video/mp4",
        },
        body: videoBytes,
      });

      uploadStatus = uploadResponse.status;
      uploadText = await uploadResponse.text();
      console.log("📦 Resposta upload TikTok:", uploadStatus, uploadText);
    } catch (uploadErr: any) {
      console.error("❌ ERRO no PUT do upload:", uploadErr.message, uploadErr.stack);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro durante upload do vídeo: ${uploadErr.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (uploadStatus < 200 || uploadStatus >= 300) {
      console.error("❌ Upload falhou:", uploadStatus, uploadText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Falha no upload do vídeo (status ${uploadStatus})`,
          upload_response: uploadText,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("✅ Upload do vídeo concluído com sucesso");

    // Salvar histórico do post
    await supabase.from("tiktok_posts").insert({
      user_id,
      content_type,
      content_url,
      title,
      post_mode,
      tiktok_response: initData,
      status: post_mode === "draft" ? "draft" : "published",
      publish_id: publishId || null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: post_mode === "draft"
          ? "Vídeo enviado para rascunhos do TikTok!"
          : "Vídeo publicado no TikTok!",
        publish_id: publishId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Erro no tiktok-post-content:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
