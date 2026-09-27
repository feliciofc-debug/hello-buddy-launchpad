import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { publishScheduledTikTok } from "../_shared/tiktok-scheduled-publish.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Pega até 5 agendamentos prontos (status pendente + horário passou)
    const { data: agendados, error } = await supabase
      .from("videos_agendados")
      .select("*")
      .eq("status", "pendente")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(5);

    if (error) throw error;

    if (!agendados || agendados.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "Nenhum agendamento pronto" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📅 Processando ${agendados.length} agendamento(s)`);

    const results: any[] = [];

    for (const item of agendados) {
      if (
        item.tiktok_next_retry_at
        && new Date(item.tiktok_next_retry_at).getTime() > Date.now()
      ) continue;
      const completedChannels = new Set<string>(
        Array.isArray(item.completed_channels) ? item.completed_channels : [],
      );
      const previousResult = item.resultado && typeof item.resultado === "object"
        ? item.resultado
        : {};
      // Marca como processando
      await supabase
        .from("videos_agendados")
        .update({ status: "processando", tentativas: (item.tentativas || 0) + 1 })
        .eq("id", item.id);

      try {
        let funcResult: any = null;
        let funcError: any = null;

        if (item.tipo === "story") {
          const { data, error } = await supabase.functions.invoke("meta-publish-story", {
            body: {
              video_url: item.video_url,
              user_id: item.user_id,
              canais: item.canais,
            },
          });
          funcResult = data;
          funcError = error;
        } else if (item.tipo === "story_imagem") {
          const { data, error } = await supabase.functions.invoke("meta-publish-story-image", {
            body: {
              image_url: item.video_url,
              user_id: item.user_id,
              link_sticker: item.link_sticker || null,
            },
          });
          funcResult = data;
          funcError = error;
          // Normaliza para o checador okAny
          if (data?.success) funcResult = { success: true, instagram: { ok: true, story_id: data.story_id }, warnings: data.warnings };
        } else if (item.tipo === "reels") {
          // Reels: publica em cada plataforma do array canais
          const reelsResult: any = { ...previousResult, success: completedChannels.size > 0 };
          let hasPendingChannel = false;
          for (const platform of item.canais) {
            if (completedChannels.has(platform) || reelsResult?.[platform]?.final === true) continue;
            if (platform === "tiktok") {
              const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
              const source = metadata?.source === "autopilot" ? "autopilot" : "scheduled";
              const tiktokResult = await publishScheduledTikTok(
                {
                  supabase,
                  supabaseUrl: SUPABASE_URL,
                  serviceKey: SERVICE_KEY,
                },
                {
                  userId: item.user_id,
                  videoUrl: item.video_url,
                  title: item.caption || "",
                  source,
                  privacyLevel: item.tiktok_privacy_level,
                  consentedAt: item.tiktok_consented_at,
                  isCommercialContent: item.tiktok_is_commercial_content,
                  brandOrganic: item.tiktok_brand_organic,
                  brandedContent: item.tiktok_branded_content,
                  videoDurationSec: item.tiktok_video_duration_sec,
                  publishId: item.tiktok_publish_id,
                  postRowId: item.tiktok_post_row_id,
                  providerBranding: metadata?.provider_branding,
                  recordTable: "videos_agendados",
                  recordId: item.id,
                },
              );
              await supabase.from("videos_agendados").update({
                tiktok_publish_id: tiktokResult.publishId || item.tiktok_publish_id || null,
                tiktok_post_row_id: tiktokResult.postRowId || item.tiktok_post_row_id || null,
                tiktok_publish_status: tiktokResult.publishStatus || null,
                tiktok_fail_reason: tiktokResult.failReason || null,
                tiktok_next_retry_at: tiktokResult.retryAt || null,
                tiktok_retry_count: tiktokResult.state === "retry"
                  ? Number(item.tiktok_retry_count || 0) + 1
                  : Number(item.tiktok_retry_count || 0),
              }).eq("id", item.id);
              if (tiktokResult.state === "processing" || tiktokResult.state === "retry") {
                hasPendingChannel = true;
                reelsResult.tiktok = {
                  ok: false,
                  pending: true,
                  state: tiktokResult.state,
                  message: tiktokResult.message,
                };
              } else if (tiktokResult.state === "published" || tiktokResult.state === "draft") {
                completedChannels.add("tiktok");
                reelsResult.tiktok = {
                  ok: true,
                  final: true,
                  state: tiktokResult.state,
                  message: tiktokResult.message,
                };
                reelsResult.success = true;
              } else {
                reelsResult.tiktok = {
                  ok: false,
                  final: true,
                  state: "failed",
                  error: tiktokResult.message,
                };
              }
            } else {
              const { data, error: pubErr } = await supabase.functions.invoke("meta-publish-reels", {
                body: {
                  platform,
                  video_url: item.video_url,
                  caption: item.caption,
                  user_id: item.user_id,
                },
              });
              if (pubErr) {
                reelsResult[platform] = { ok: false, final: true, error: pubErr.message };
              } else if (data?.success) {
                reelsResult[platform] = { ok: true, final: true, post_id: data.post_id };
                completedChannels.add(platform);
                reelsResult.success = true;
              } else {
                reelsResult[platform] = { ok: false, final: true, error: data?.error || "Erro desconhecido" };
              }
            }
          }
          reelsResult.pending = hasPendingChannel;
          funcResult = reelsResult;
        }

        if (funcError) {
          throw new Error(funcError.message || "Erro na publicação");
        }

        // Verifica se ao menos um canal funcionou
        const okFb = funcResult?.facebook?.ok;
        const okIg = funcResult?.instagram?.ok;
        const okAny = okFb || okIg || funcResult?.success;

        if (funcResult?.pending) {
          await supabase
            .from("videos_agendados")
            .update({
              status: "pendente",
              resultado: funcResult,
              completed_channels: [...completedChannels],
              erro: null,
            })
            .eq("id", item.id);
          results.push({ id: item.id, ok: false, pending: true });
        } else if (okAny) {
          await supabase
            .from("videos_agendados")
            .update({
              status: "publicado",
              resultado: funcResult,
              completed_channels: [...completedChannels],
              published_at: new Date().toISOString(),
              erro: null,
            })
            .eq("id", item.id);

          results.push({ id: item.id, ok: true });
        } else {
          const errMsg = funcResult?.facebook?.error || funcResult?.instagram?.error || "Falha em todos os canais";
          await supabase
            .from("videos_agendados")
            .update({
              status: "erro",
              resultado: funcResult,
              erro: errMsg,
            })
            .eq("id", item.id);

          results.push({ id: item.id, ok: false, error: errMsg });
        }
      } catch (err: any) {
        console.error(`❌ Erro no agendamento ${item.id}:`, err);
        await supabase
          .from("videos_agendados")
          .update({
            status: "erro",
            erro: err?.message || String(err),
          })
          .eq("id", item.id);

        results.push({ id: item.id, ok: false, error: err?.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: agendados.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Erro geral:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
