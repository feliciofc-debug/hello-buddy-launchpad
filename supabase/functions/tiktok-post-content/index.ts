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
      .eq("active", true)
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ success: false, error: "TikTok não conectado. Por favor, conecte sua conta primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = integration.access_token;

    // Verificar se token expirou
    if (integration.expires_at && new Date(integration.expires_at) < new Date()) {
      // TODO: Implementar refresh token
      return new Response(
        JSON.stringify({ success: false, error: "Token expirado. Por favor, reconecte sua conta TikTok." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determinar endpoint baseado no modo de postagem
    const endpoint = post_mode === "draft"
      ? "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/"
      : "https://open.tiktokapis.com/v2/post/publish/video/init/";

    // Preparar payload para TikTok API
    const tiktokPayload = {
      post_info: {
        title: title.substring(0, 150), // Limite de caracteres do TikTok
        privacy_level: "SELF_ONLY", // Para rascunhos
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: content_url,
      }
    };

    // Se for post direto, mudar privacy_level
    if (post_mode === "direct") {
      tiktokPayload.post_info.privacy_level = "PUBLIC_TO_EVERYONE";
    }

    console.log("Enviando para TikTok:", { endpoint, payload: tiktokPayload });

    // Chamar API do TikTok
    const tiktokResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(tiktokPayload),
    });

    const tiktokData = await tiktokResponse.json();
    console.log("Resposta TikTok:", tiktokData);

    if (tiktokData.error?.code) {
      // Tratar erros específicos da API TikTok
      let errorMessage = "Erro ao postar no TikTok";
      
      switch (tiktokData.error.code) {
        case "access_token_invalid":
          errorMessage = "Token inválido. Reconecte sua conta TikTok.";
          break;
        case "rate_limit_exceeded":
          errorMessage = "Limite de requisições atingido. Tente novamente em alguns minutos.";
          break;
        case "video_upload_failed":
          errorMessage = "Falha no upload do vídeo. Verifique se o formato é suportado.";
          break;
        default:
          errorMessage = tiktokData.error.message || errorMessage;
      }

      return new Response(
        JSON.stringify({ success: false, error: errorMessage, tiktok_error: tiktokData.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Salvar histórico do post
    await supabase.from("tiktok_posts").insert({
      user_id,
      content_type,
      content_url,
      title,
      post_mode,
      tiktok_response: tiktokData,
      status: post_mode === "draft" ? "draft" : "published",
      publish_id: tiktokData.data?.publish_id || null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: post_mode === "draft" 
          ? "Vídeo enviado para rascunhos do TikTok!" 
          : "Vídeo publicado no TikTok!",
        publish_id: tiktokData.data?.publish_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Erro no tiktok-post-content:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
