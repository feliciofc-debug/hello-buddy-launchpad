import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StatusRequest {
  user_id: string;
  publish_id: string;
}

const TERMINAL_STATUSES = ["PUBLISH_COMPLETE", "SEND_TO_USER_INBOX", "FAILED"];

function mapLegacyStatus(status: string): string {
  switch (status) {
    case "PUBLISH_COMPLETE":
      return "published";
    case "SEND_TO_USER_INBOX":
      return "draft";
    case "FAILED":
      return "failed";
    default:
      return "processing";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id, publish_id }: StatusRequest = await req.json();

    if (!user_id || !publish_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros obrigatórios faltando (user_id, publish_id)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar token do usuário
    const { data: integration, error: integrationError } = await supabase
      .from("integrations")
      .select("access_token, token_expires_at")
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

    // === Consultar status real da publicação no TikTok ===
    const statusResponse = await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id }),
    });

    const statusData = await statusResponse.json();
    console.log("📦 Resposta status TikTok:", JSON.stringify(statusData));

    const tiktokErrorCode = statusData?.error?.code;
    if (!statusResponse.ok || (tiktokErrorCode && tiktokErrorCode !== "ok")) {
      const errorMessage =
        statusData?.error?.message || `Erro ao consultar status no TikTok (status ${statusResponse.status})`;
      return new Response(
        JSON.stringify({ success: false, error: errorMessage, tiktok_error: statusData?.error ?? null }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const status: string = statusData?.data?.status || "PROCESSING_UPLOAD";
    const failReason: string | null = statusData?.data?.fail_reason ?? null;

    // ⚠️ "publicaly_available_post_id" é o nome real (com erro de grafia) na API do TikTok.
    const publicIds = statusData?.data?.publicaly_available_post_id;
    const postId: string | null =
      Array.isArray(publicIds) && publicIds.length > 0 ? String(publicIds[0]) : null;

    const terminal = TERMINAL_STATUSES.includes(status);

    // === Atualizar registro do tenant (isolamento por user_id + publish_id) ===
    const { data: updatedRows, error: updateError } = await supabase
      .from("tiktok_posts")
      .update({
        publish_status: status,
        fail_reason: failReason,
        tiktok_post_id: postId,
        status: mapLegacyStatus(status),
        checked_at: new Date().toISOString(),
      })
      .eq("publish_id", publish_id)
      .eq("user_id", user_id)
      .select("id");

    if (updateError) {
      console.error("⚠️ Erro ao atualizar tiktok_posts:", updateError.message);
    } else if (!updatedRows || updatedRows.length === 0) {
      console.warn(
        `⚠️ Nenhuma linha atualizada: publish_id ${publish_id} não pertence ao user_id ${user_id} (ou não existe).`
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        status,
        fail_reason: failReason,
        post_id: postId,
        terminal,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Erro no tiktok-post-status:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
