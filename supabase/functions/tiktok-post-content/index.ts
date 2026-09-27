import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getValidTikTokAccessToken,
  TIKTOK_RECONNECT_MESSAGE,
} from "../_shared/tiktok-token.ts";

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
  // Compliance UX (Direct Post)
  privacy_level?: string;
  disable_comment?: boolean;
  disable_duet?: boolean;
  disable_stitch?: boolean;
  is_commercial_content?: boolean;
  brand_organic?: boolean;
  branded_content?: boolean;
  consented_at?: string;
  scheduled_record_table?: "social_posts_queue" | "videos_agendados";
  scheduled_record_id?: string;
  // Scheduled só pode fazer Direct Post com consentimento persistido no registro.
  // Autopilot sempre usa o inbox/rascunho.
  source?: "manual" | "scheduled" | "autopilot";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: PostRequest = await req.json();
    const {
      user_id,
      content_type,
      content_url,
      title,
      privacy_level,
      disable_comment = false,
      disable_duet = false,
      disable_stitch = false,
      is_commercial_content = false,
      brand_organic = false,
      branded_content = false,
      consented_at,
      scheduled_record_table,
      scheduled_record_id,
      source = "manual",
    } = body;

    // Defesa em profundidade: piloto automático nunca publica direto. Um
    // agendamento só pode usar Direct Post com privacidade e consentimento
    // explícitos, persistidos no próprio registro e enviados pelo executor.
    let post_mode = body.post_mode;
    let persistedScheduledConsent = false;
    if (
      source === "scheduled"
      && scheduled_record_id
      && (scheduled_record_table === "social_posts_queue" || scheduled_record_table === "videos_agendados")
    ) {
      const { data: scheduledRecord } = await supabase
        .from(scheduled_record_table)
        .select("user_id, tiktok_privacy_level, tiktok_consented_at")
        .eq("id", scheduled_record_id)
        .eq("user_id", user_id)
        .maybeSingle();
      persistedScheduledConsent = !!(
        scheduledRecord?.tiktok_consented_at
        && scheduledRecord?.tiktok_privacy_level
        && scheduledRecord.tiktok_privacy_level === privacy_level
        && scheduledRecord.tiktok_consented_at === consented_at
      );
    }
    if (source === "autopilot" || (source === "scheduled" && !persistedScheduledConsent)) {
      console.log(`🔒 Coerção TikTok: source="${source}" sem consentimento completo -> rascunho`);
      post_mode = "draft";
    }

    if (!user_id || !content_url || !title) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros obrigatórios faltando" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (content_type !== "video") {
      return new Response(
        JSON.stringify({ success: false, error: "O TikTok aceita apenas vídeo neste fluxo de publicação." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Título: limite oficial de 2200 caracteres
    const safeTitle = title.substring(0, 2200);

    // Direct Post exige as escolhas de compliance feitas pelo usuário
    if (post_mode === "direct" && !privacy_level) {
      return new Response(
        JSON.stringify({ success: false, error: "Selecione quem pode ver este vídeo antes de publicar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (post_mode === "direct" && is_commercial_content && !brand_organic && !branded_content) {
      return new Response(
        JSON.stringify({ success: false, error: "Indique se o conteúdo promove sua própria marca ou uma marca de terceiros." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (post_mode === "direct" && branded_content && privacy_level === "SELF_ONLY") {
      return new Response(
        JSON.stringify({ success: false, error: "Conteúdo de marca não pode ser publicado como visível apenas para você." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = await getValidTikTokAccessToken(supabase, user_id);
    if (!token.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: token.error,
          message: token.error === "tiktok_reconnect_required"
            ? TIKTOK_RECONNECT_MESSAGE
            : "TikTok não conectado.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = token.accessToken;

    // Direct Post só aceita valores anunciados por creator_info para esta conta.
    // Consulta em tempo real para não usar opção antiga ou de outro perfil.
    if (post_mode === "direct") {
      const creatorResponse = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
      });
      const creatorData = await creatorResponse.json();
      const allowedPrivacy = Array.isArray(creatorData?.data?.privacy_level_options)
        ? creatorData.data.privacy_level_options
        : [];
      console.log("🔐 TikTok privacy preflight:", {
        http_status: creatorResponse.status,
        requested: privacy_level,
        allowed: allowedPrivacy,
      });
      if (!creatorResponse.ok || creatorData?.error?.code && creatorData.error.code !== "ok") {
        const reconnectRequired = creatorResponse.status === 401
          || creatorData?.error?.code === "access_token_invalid";
        return new Response(
          JSON.stringify({
            success: false,
            error: reconnectRequired ? "tiktok_reconnect_required" : (creatorData?.error?.message || "Não foi possível consultar a privacidade disponível no TikTok."),
            message: reconnectRequired ? TIKTOK_RECONNECT_MESSAGE : undefined,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!privacy_level || !allowedPrivacy.includes(privacy_level)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "A privacidade escolhida não está disponível para esta conta TikTok.",
            privacy_level_options: allowedPrivacy,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

    // Detectar o Content-Type real do vídeo (Content Posting API aceita mp4, quicktime e webm)
    const headerType = videoResponse.headers.get("content-type") || "";
    const urlExt = (content_url.split("?")[0].split(".").pop() || "").toLowerCase();
    const extMap: Record<string, string> = {
      mp4: "video/mp4",
      mov: "video/quicktime",
      webm: "video/webm",
    };
    const videoContentType =
      headerType.startsWith("video/") ? headerType : (extMap[urlExt] || "video/mp4");

    console.log("🎞️ Content-Type detectado:", videoContentType);

    // === PASSO 2: Iniciar upload no TikTok (FILE_UPLOAD) ===
    // TIKTOK_ENV controla o comportamento:
    //  - sandbox  -> app não auditado: TikTok só aceita inbox (rascunho) + SELF_ONLY
    //  - producao -> Direct Post aprovado: post_mode "direct" publica direto no perfil
    const tiktokEnv = (Deno.env.get("TIKTOK_ENV") || "sandbox").toLowerCase();
    const isProducao = tiktokEnv === "producao" || tiktokEnv === "production";
    // Permite testar Direct Post em sandbox (conteúdo sai como SELF_ONLY).
    // Em produção auditada, o mesmo caminho publica com a privacidade escolhida.
    const directPost = post_mode === "direct";

    const endpoint = directPost
      ? "https://open.tiktokapis.com/v2/post/publish/video/init/"
      : "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";

    // Em sandbox (app não auditado) só SELF_ONLY é aceito.
    // Falhar explicitamente é melhor que trocar sem avisar.
    if (directPost && !isProducao && privacy_level && privacy_level !== "SELF_ONLY") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Enquanto o app não for auditado pelo TikTok, apenas 'Somente eu' está disponível. Escolha essa opção para publicar em modo de teste.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Em produção respeitamos a escolha do usuário (vinda de creator_info).
    const privacyLevel = isProducao ? (privacy_level || "SELF_ONLY") : "SELF_ONLY";


    const tiktokPayload: Record<string, unknown> = {
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    };

    // O endpoint de inbox (rascunho) NÃO aceita post_info — só o Direct Post aceita.
    if (directPost) {
      tiktokPayload.post_info = {
        title: safeTitle,
        privacy_level: privacyLevel,
        disable_duet: !!disable_duet,
        disable_comment: !!disable_comment,
        disable_stitch: !!disable_stitch,
        video_cover_timestamp_ms: 1000,
        brand_content_toggle: !!branded_content,
        brand_organic_toggle: !!brand_organic,
      };
    }


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

    const initErrorCode = initData?.error?.code;
    if (!initResponse.ok || (initErrorCode && initErrorCode !== "ok")) {
      let errorMessage = `Erro ao iniciar upload no TikTok (status ${initResponse.status})`;
      switch (initErrorCode) {
        case "access_token_invalid":
          errorMessage = TIKTOK_RECONNECT_MESSAGE;
          break;
        case "rate_limit_exceeded":
          errorMessage = "Limite de requisições atingido. Tente novamente em alguns minutos.";
          break;
        case "spam_risk_too_many_posts":
          errorMessage = "Muitas publicações recentes. Aguarde um pouco.";
          break;
        case "spam_risk_too_many_pending_share":
          errorMessage = "Há muitos envios pendentes no TikTok. Aguarde antes de tentar novamente.";
          break;
        case "reached_active_user_cap":
          errorMessage = "O TikTok pediu para adiar este envio. Tente novamente mais tarde.";
          break;
        case "unaudited_client_can_only_post_to_private_accounts":
          errorMessage = "A conta TikTok precisa estar configurada como privada para publicar durante os testes. Ative 'Conta Privada' nas configurações do TikTok.";
          break;
        case "scope_not_authorized":
          errorMessage = "Permissão video.publish não autorizada. Desconecte e reconecte a conta TikTok para conceder a permissão.";
          break;
        default:
          errorMessage = initData?.error?.message || errorMessage;
      }

      return new Response(
        JSON.stringify({ success: false, error: errorMessage, tiktok_error: initData?.error ?? null }),
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
          "Content-Type": videoContentType,
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

    // Salvar histórico do post (status real só é conhecido via polling em tiktok-post-status)
    const { data: postRow, error: insertError } = await supabase
      .from("tiktok_posts")
      .insert({
        user_id,
        content_type,
        content_url,
        title: safeTitle,
        post_mode,
        privacy_level: post_mode === "direct" ? privacyLevel : null,
        disable_comment: !!disable_comment,
        disable_duet: !!disable_duet,
        disable_stitch: !!disable_stitch,
        is_commercial_content: !!is_commercial_content,
        brand_organic: !!brand_organic,
        branded_content: !!branded_content,
        consent_accepted_at: consented_at || (source === "manual" ? new Date().toISOString() : null),
        source,
        tiktok_response: initData,
        status: "processing",
        publish_status: "PROCESSING_UPLOAD",
        publish_id: publishId || null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("⚠️ Erro ao salvar histórico do post:", insertError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        direct_post: directPost,
        message: directPost
          ? "Vídeo enviado ao TikTok e em processamento."
          : "Vídeo enviado ao TikTok. O rascunho está sendo preparado para a caixa de entrada.",
        publish_id: publishId,
        post_row_id: postRow?.id ?? null,
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
