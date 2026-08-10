import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { data: integration, error: integrationError } = await supabase
      .from("integrations")
      .select("access_token, token_expires_at")
      .eq("user_id", user_id)
      .eq("platform", "tiktok")
      .eq("is_active", true)
      .maybeSingle();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ success: false, error: "not_connected" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (integration.token_expires_at && new Date(integration.token_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "token_expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resp = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
    });

    const json = await resp.json();
    console.log("📦 creator_info:", resp.status, JSON.stringify(json));

    const errCode = json?.error?.code;
    if (!resp.ok || (errCode && errCode !== "ok")) {
      let message = json?.error?.message || `Falha ao consultar o TikTok (status ${resp.status})`;
      if (errCode === "access_token_invalid" || resp.status === 401) {
        message = "Token inválido. Reconecte sua conta TikTok.";
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
