import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getValidTikTokAccessToken,
  TIKTOK_RECONNECT_MESSAGE,
  TIKTOK_TEMPORARILY_UNAVAILABLE_MESSAGE,
} from "../_shared/tiktok-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Query Creator Info — obrigatório antes de exibir a UI de publicação (Direct Post).
// NUNCA cachear: os dados precisam ser buscados a cada abertura do modal.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "missing_user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let token = await getValidTikTokAccessToken(supabase, user_id);
    if (!token.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: token.error,
          message: token.error === "tiktok_reconnect_required"
            ? TIKTOK_RECONNECT_MESSAGE
            : token.error === "tiktok_temporarily_unavailable"
              ? TIKTOK_TEMPORARILY_UNAVAILABLE_MESSAGE
              : "TikTok não conectado.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const queryCreator = (accessToken: string) =>
      fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
      });
    let resp = await queryCreator(token.accessToken);
    let json = await resp.json();
    if (resp.status === 401 || json?.error?.code === "access_token_invalid") {
      token = await getValidTikTokAccessToken(supabase, user_id, { forceRefresh: true });
      if (!token.ok) {
        return new Response(
          JSON.stringify({ success: false, error: token.error, message: token.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      resp = await queryCreator(token.accessToken);
      json = await resp.json();
    }
    console.log("📦 creator_info:", resp.status, JSON.stringify(json));

    const errCode = json?.error?.code;
    if (!resp.ok || (errCode && errCode !== "ok")) {
      let message = json?.error?.message || `Falha ao consultar o TikTok (status ${resp.status})`;
      if (errCode === "access_token_invalid" || resp.status === 401) {
        message = TIKTOK_RECONNECT_MESSAGE;
      } else if (errCode === "spam_risk_too_many_pending_share") {
        message = "Muitas publicações pendentes no TikTok. Aguarde alguns minutos.";
      } else if (errCode === "reached_active_user_cap") {
        message = "Limite de usuários ativos do app atingido. Tente novamente mais tarde.";
      }
      return new Response(
        JSON.stringify({ success: false, error: message, tiktok_error: json?.error ?? null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const d = json?.data ?? {};

    return new Response(
      JSON.stringify({
        success: true,
        creator_avatar_url: d.creator_avatar_url ?? null,
        creator_username: d.creator_username ?? null,
        creator_nickname: d.creator_nickname ?? null,
        privacy_level_options: Array.isArray(d.privacy_level_options) ? d.privacy_level_options : [],
        comment_disabled: !!d.comment_disabled,
        duet_disabled: !!d.duet_disabled,
        stitch_disabled: !!d.stitch_disabled,
        max_video_post_duration_sec: d.max_video_post_duration_sec ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("❌ Erro em tiktok-creator-info:", error?.message, error?.stack);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Erro inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
