// ============================================================
// video-publicar-aprovado
// Publica um job de vídeo que JÁ foi renderizado e APROVADO pelo dono.
// Só roda depois de uma aprovação explícita no WhatsApp.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  friendlyMetaVideoPublishError,
  renderedMetaVideoFormat,
  shouldNotifyVideoPublishCaller,
  validateMetaVideoForPublishing,
} from "../_shared/meta-video-requirements.ts";
import { readyVideoRerenderButtons } from "../_shared/ready-media-actions.ts";
import { formatVideoPublishMessage } from "../_shared/video-publish-message.ts";
import {
  formatPublishErrorLogEntry,
  loadConnectedPublishPlatforms,
  mergePublishedPosts,
  notConnectedPublishMessage,
  readJobPublishedPosts,
  resolveVideoPublisher,
  sanitizePublishApiDetail,
  uniqueVideoPublishPlatforms,
} from "../_shared/video-publish-platforms.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function resp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function isConnected(
  connected: Awaited<ReturnType<typeof loadConnectedPublishPlatforms>>,
  platform: string,
): boolean {
  const p = platform.toLowerCase();
  if (p === "facebook") return connected.facebook;
  if (p === "instagram") return connected.instagram;
  if (p === "linkedin") return connected.linkedin;
  if (p === "tiktok") return connected.tiktok;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { job_id, notify_whatsapp = true } = await req.json();
    if (!job_id) throw new Error("job_id obrigatório");

    const { data: job } = await supabase
      .from("video_render_jobs")
      .select("*")
      .eq("id", job_id)
      .maybeSingle();
    if (!job) throw new Error("job não encontrado");
    if (
      !["aguardando_aprovacao", "aprovado", "erro_publicacao", "publicado_parcial"].includes(
        job.status,
      )
    ) {
      throw new Error(`job em status inválido para publicar: ${job.status}`);
    }

    if (!job.resultado_path || !job.resultado_bucket) {
      await supabase
        .from("video_render_jobs")
        .update({
          status: "erro_publicacao",
          erro_mensagem:
            "sem vídeo legendado (resultado_bucket/resultado_path nulos) — publicação bloqueada",
        })
        .eq("id", job.id);
      return resp({
        success: false,
        error: "job sem vídeo legendado — nada foi publicado",
      });
    }

    const bucket = job.resultado_bucket;
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(
      job.resultado_path,
    );
    const videoUrl = pub?.publicUrl;
    if (!videoUrl) {
      throw new Error("URL pública do vídeo legendado indisponível");
    }
    console.log(
      `[video-publicar-aprovado] publicando LEGENDADO ${bucket}/${job.resultado_path}`,
    );

    const pedidas: string[] = Array.isArray(job.metadata?.plataformas_pedidas)
      ? job.metadata.plataformas_pedidas
      : [];
    const plataformas = uniqueVideoPublishPlatforms(
      pedidas.length
        ? pedidas
        : (Array.isArray(job.plataformas) && job.plataformas.length
          ? job.plataformas
          : ["instagram", "facebook"]),
    );

    const formato = renderedMetaVideoFormat(
      job.formato,
      job.metadata?.video_output,
    );
    const ehStory = formato === "story";
    console.log(
      `[video-publicar-aprovado] formato=${formato} plataformas=${
        plataformas.join(",")
      }`,
    );

    let sizeBytes = Number(job.metadata?.video_output?.size_bytes);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      try {
        const head = await fetch(videoUrl, { method: "HEAD" });
        sizeBytes = Number(head.headers.get("content-length"));
      } catch {
        sizeBytes = Number.NaN;
      }
    }
    const validation = validateMetaVideoForPublishing({
      format: formato,
      path: job.resultado_path,
      durationSeconds: job.duracao_segundos,
      output: job.metadata?.video_output,
      sizeBytes,
    });
    if (!validation.ok) {
      const message = `Não publiquei o vídeo: ${validation.message}`;
      await supabase.from("video_render_jobs").update({
        status: "erro_publicacao",
        erro_mensagem: validation.message,
        formato,
      }).eq("id", job.id);
      if (job.telefone && shouldNotifyVideoPublishCaller(notify_whatsapp)) {
        const { data: renderedMedia } = await supabase
          .from("midias_whatsapp")
          .select("id")
          .eq("user_id", job.user_id)
          .eq("midia_url", videoUrl)
          .limit(1)
          .maybeSingle();
        await supabase.functions.invoke("whatsapp-send-message", {
          body: {
            user_id: job.user_id,
            to: job.telefone,
            message,
            ...(renderedMedia?.id
              ? {
                interactive_buttons: readyVideoRerenderButtons(
                  renderedMedia.id,
                ),
              }
              : {}),
          },
        });
      }
      return resp({
        success: false,
        error: validation.message,
        validation_error: true,
      });
    }

    const connected = await loadConnectedPublishPlatforms(supabase, job.user_id);
    let publishedPosts = readJobPublishedPosts(job.metadata);
    const publicados: string[] = [];
    const erros: string[] = [];
    const erroLogs: string[] = [];
    const links: Array<{ plataforma: string; url: string }> = [];
    const caption = job.copy_escolhida || job.caption || " ";

    const recordSuccess = (
      plataforma: string,
      res: { post_url?: string; post_id?: string; post_urn?: string },
    ) => {
      publicados.push(plataforma);
      publishedPosts = mergePublishedPosts(publishedPosts, plataforma, {
        post_id: res.post_id,
        post_url: res.post_url,
        post_urn: res.post_urn,
      });
      if (typeof res.post_url === "string" && res.post_url) {
        links.push({ plataforma, url: res.post_url });
      }
    };

    const recordFailure = (plataforma: string, error: unknown) => {
      const detail = sanitizePublishApiDetail(error);
      const friendly = friendlyMetaVideoPublishError(plataforma, detail.message);
      erros.push(friendly);
      erroLogs.push(formatPublishErrorLogEntry(plataforma, friendly, detail));
    };

    if (ehStory) {
      const targets = plataformas.filter((p) => {
        const prior = publishedPosts[String(p).toLowerCase()];
        return !(prior?.post_id || prior?.post_url || prior?.post_urn);
      });
      try {
        const { data: res, error: sErr } = await supabase.functions.invoke(
          "meta-publish-story",
          {
            body: {
              video_url: videoUrl,
              user_id: job.user_id,
              canais: targets.filter((p) => isConnected(connected, p)),
            },
          },
        );
        if (sErr) throw sErr;
        for (const plataforma of targets) {
          if (!isConnected(connected, plataforma)) {
            recordFailure(plataforma, notConnectedPublishMessage(plataforma));
            continue;
          }
          const r = res?.[plataforma];
          if (r?.ok) {
            recordSuccess(plataforma, {
              post_url: r?.post_url,
              post_id: r?.post_id,
            });
          } else {
            recordFailure(plataforma, r?.error || res?.error || "falhou");
          }
        }
      } catch (e) {
        erros.push(friendlyMetaVideoPublishError("story", e));
      }
    } else {
      for (const plataforma of plataformas) {
        const prior = publishedPosts[plataforma.toLowerCase()];
        if (prior?.post_id || prior?.post_url || prior?.post_urn) {
          publicados.push(plataforma);
          if (prior.post_url) {
            links.push({ plataforma, url: prior.post_url });
          }
          continue;
        }
        if (!isConnected(connected, plataforma)) {
          recordFailure(plataforma, notConnectedPublishMessage(plataforma));
          continue;
        }
        const route = resolveVideoPublisher(plataforma, formato);
        if (route.kind === "skip") {
          recordFailure(plataforma, route.reason || "ignorado");
          continue;
        }
        try {
          let functionName = "meta-publish-reels";
          let body: Record<string, unknown> = {};
          if (route.kind === "meta-post") {
            functionName = "meta-publish-post";
            body = {
              message: caption,
              video_url: videoUrl,
              user_id: job.user_id,
              preserve_caption: true,
            };
          } else if (route.kind === "meta-instagram" || route.kind === "meta-reels") {
            functionName = "meta-publish-reels";
            body = {
              platform: plataforma,
              video_url: videoUrl,
              caption,
              user_id: job.user_id,
              preserve_caption: true,
            };
          } else if (route.kind === "linkedin") {
            functionName = "linkedin-publish";
            body = {
              user_id: job.user_id,
              texto: caption,
              video_url: videoUrl,
            };
          } else if (route.kind === "tiktok") {
            functionName = "tiktok-post-content";
            body = {
              user_id: job.user_id,
              content_type: "video",
              content_url: videoUrl,
              title: caption.slice(0, 2200),
              post_mode: "direct",
              privacy_level: "PUBLIC_TO_EVERYONE",
            };
          }
          const { data: res, error: pErr } = await supabase.functions.invoke(
            functionName,
            { body },
          );
          if (pErr) throw pErr;
          const ok = res?.success === true || /^urn:li:/i.test(String(res?.post_urn || ""));
          if (ok) {
            recordSuccess(plataforma, {
              post_url: res?.post_url,
              post_id: res?.post_id,
              post_urn: res?.post_urn,
            });
          } else {
            recordFailure(plataforma, res?.error || "falhou");
          }
        } catch (e) {
          recordFailure(plataforma, e);
        }
      }
    }

    const attempted = plataformas.length;
    const successCount = new Set(publicados.map((p) => p.toLowerCase())).size;
    const status = successCount === 0
      ? "erro_publicacao"
      : erros.length > 0 || successCount < attempted
      ? "publicado_parcial"
      : "publicado";
    await supabase
      .from("video_render_jobs")
      .update({
        status,
        erro_mensagem: erroLogs.length ? erroLogs.join(" | ") : null,
        metadata: {
          ...(job.metadata || {}),
          publicados: publishedPosts,
        },
      })
      .eq("id", job.id);

    if (job.telefone && shouldNotifyVideoPublishCaller(notify_whatsapp)) {
      const msg = formatVideoPublishMessage({
        published: publicados,
        links,
        errors: erros,
      });
      try {
        await supabase.functions.invoke("whatsapp-send-message", {
          body: { user_id: job.user_id, to: job.telefone, message: msg },
        });
      } catch (e) {
        console.error("[video-publicar-aprovado] aviso falhou:", e);
      }
    }

    return resp({
      success: status === "publicado",
      partial: status === "publicado_parcial",
      plataformas: publicados,
      erros,
      links,
    });
  } catch (e) {
    console.error("[video-publicar-aprovado] erro:", e);
    return resp({ success: false, error: (e as Error)?.message || "erro" });
  }
});
